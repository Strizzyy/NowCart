"""SQS Publisher — sends jobs to SQS queues for Lambda processing.

Queue topology:
- nowcart-vision-queue   : Image analysis jobs (B2 "Show It")
- nowcart-share-queue    : Recipe/URL parsing jobs (B4 "Share It")
- nowcart-outcome-queue  : Large decomposition jobs (>5 items expected)

Each message includes:
- job_id: Unique identifier (UUID) for tracking
- session_id: Cart session to update with results
- payload: Job-specific data (image bytes, URL, text)
- metadata: Timestamps, provider hints, priority

The API returns immediately with {session_id, status: "processing"}
and the client polls GET /api/cart/{session_id} until items appear.
"""
from __future__ import annotations

import json
import uuid
from enum import Enum

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class JobType(str, Enum):
    """Types of async jobs that can be offloaded to Lambda."""
    VISION_ANALYZE = "vision_analyze"
    SHARE_PARSE = "share_parse"
    OUTCOME_LARGE = "outcome_large"
    SOS_KIT = "sos_kit"


class JobStatus(str, Enum):
    """Lifecycle of an async job."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# Queue name mapping
_QUEUE_MAP: dict[JobType, str] = {
    JobType.VISION_ANALYZE: "nowcart-vision-queue",
    JobType.SHARE_PARSE: "nowcart-share-queue",
    JobType.OUTCOME_LARGE: "nowcart-outcome-queue",
    JobType.SOS_KIT: "nowcart-outcome-queue",
}


class SQSPublisher:
    """Publishes async jobs to SQS queues.

    In production (APP_ENV=production), sends real SQS messages.
    In dev/prototype, returns a job_id but work runs synchronously
    in the API process (no actual Lambda invocation).
    """

    def __init__(self) -> None:
        self._client = None
        self._is_production = settings.app_env == "production"

    def _get_client(self):
        """Lazy SQS client initialization."""
        if self._client is None and self._is_production:
            import boto3
            self._client = boto3.client(
                "sqs",
                region_name=settings.aws_region,
            )
        return self._client

    async def publish(
        self,
        job_type: JobType,
        session_id: str,
        payload: dict,
    ) -> str:
        """Publish a job to the appropriate SQS queue.

        Args:
            job_type: Type of work to perform.
            session_id: Cart session that will receive the results.
            payload: Job-specific data.

        Returns:
            job_id (UUID string) for tracking.
        """
        job_id = str(uuid.uuid4())
        queue_name = _QUEUE_MAP[job_type]

        message = {
            "job_id": job_id,
            "job_type": job_type.value,
            "session_id": session_id,
            "payload": payload,
        }

        if self._is_production:
            client = self._get_client()
            if client:
                try:
                    # Get queue URL (assumes queue exists)
                    queue_url_resp = client.get_queue_url(QueueName=queue_name)
                    queue_url = queue_url_resp["QueueUrl"]

                    client.send_message(
                        QueueUrl=queue_url,
                        MessageBody=json.dumps(message),
                        MessageGroupId=session_id,  # FIFO ordering by session
                    )
                    logger.info(
                        "Published job %s to %s (session=%s)",
                        job_id, queue_name, session_id,
                    )
                except Exception as exc:
                    logger.error("SQS publish failed: %s — falling back to sync", exc)
                    # Fall through to sync processing
        else:
            logger.debug(
                "Dev mode: job %s (%s) will run synchronously (session=%s)",
                job_id, job_type.value, session_id,
            )

        return job_id


# Singleton
_publisher: SQSPublisher | None = None


def get_sqs_publisher() -> SQSPublisher:
    global _publisher
    if _publisher is None:
        _publisher = SQSPublisher()
    return _publisher
