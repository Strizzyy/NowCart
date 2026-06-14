"""Lambda handler stubs — the code that runs inside AWS Lambda functions.

Each handler:
1. Receives an SQS event (batch of messages)
2. Processes the job (LLM call, image analysis, URL parsing)
3. Writes the result to DynamoDB / Redis (cart update)
4. The client polling GET /api/cart/{session_id} picks up the result

Deployment:
    zip -r lambda_vision.zip app/
    aws lambda create-function --function-name nowcart-vision ...

Lambda Configuration:
    Runtime: python3.11
    Memory: 256 MB
    Timeout: 30 seconds
    Layers: [groq-sdk, google-generativeai, rapidfuzz]
    Environment:
        GROQ_API_KEY: (from Secrets Manager)
        GEMINI_API_KEY: (from Secrets Manager)
        AWS_REGION: ap-south-1
        DATA_BACKEND: dynamodb

Architecture benefits:
- Auto-scales to 1000 concurrent executions (1000 simultaneous LLM calls)
- Pay only for execution time (100ms granularity)
- Dead letter queue catches failures after 3 retries
- No blocking of the API server — instant response to user
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def vision_handler(event: dict, context: Any) -> dict:
    """Lambda handler: process image analysis jobs from SQS.

    Trigger: nowcart-vision-queue
    Input: {job_id, session_id, payload: {image_b64, text_hint}}
    Output: Updates cart in DynamoDB/Redis with identified ingredients

    Flow:
    1. Decode base64 image from payload
    2. Call Gemini Vision to identify dish + ingredients
    3. Run outcome engine (decompose → match → optimize)
    4. Save resulting cart to cache (Redis/DynamoDB)
    """
    records = event.get("Records", [])
    results = []

    for record in records:
        body = json.loads(record["body"])
        job_id = body["job_id"]
        session_id = body["session_id"]
        payload = body["payload"]

        logger.info("Processing vision job %s (session=%s)", job_id, session_id)

        try:
            # In production, this would:
            # 1. import app.services.vision_service
            # 2. Decode payload["image_b64"]
            # 3. Call vision_service.analyze_image(image_bytes, text_hint)
            # 4. Save cart to cache/DynamoDB
            #
            # For now, this is a stub showing the Lambda contract.
            results.append({
                "job_id": job_id,
                "status": "completed",
                "session_id": session_id,
            })
        except Exception as exc:
            logger.error("Vision job %s failed: %s", job_id, exc)
            results.append({
                "job_id": job_id,
                "status": "failed",
                "error": str(exc),
            })

    return {"statusCode": 200, "body": json.dumps(results)}


def share_handler(event: dict, context: Any) -> dict:
    """Lambda handler: process recipe/URL parsing jobs from SQS.

    Trigger: nowcart-share-queue
    Input: {job_id, session_id, payload: {url, text}}
    Output: Updates cart in DynamoDB/Redis with parsed ingredients

    Flow:
    1. Fetch URL content (httpx)
    2. Call Groq LLM to extract recipe/ingredients
    3. Run outcome engine pipeline
    4. Save resulting cart to cache
    """
    records = event.get("Records", [])
    results = []

    for record in records:
        body = json.loads(record["body"])
        job_id = body["job_id"]
        session_id = body["session_id"]

        logger.info("Processing share job %s (session=%s)", job_id, session_id)

        try:
            # Production implementation:
            # 1. import app.services.share_service
            # 2. Call share_service.parse_shared_content(url, text)
            # 3. Save cart to cache
            results.append({
                "job_id": job_id,
                "status": "completed",
                "session_id": session_id,
            })
        except Exception as exc:
            logger.error("Share job %s failed: %s", job_id, exc)
            results.append({
                "job_id": job_id,
                "status": "failed",
                "error": str(exc),
            })

    return {"statusCode": 200, "body": json.dumps(results)}


def outcome_handler(event: dict, context: Any) -> dict:
    """Lambda handler: process large outcome decompositions from SQS.

    Trigger: nowcart-outcome-queue
    Input: {job_id, session_id, payload: {text, servings, mode}}
    Output: Updates cart in DynamoDB/Redis

    Offloaded when:
    - Outcome text suggests >8 items (party planning, weekly restock)
    - Budget mode with complex constraints
    - SOS mode with AI kit generation

    This keeps the API server responsive while heavy LLM reasoning
    happens in Lambda (auto-scales to 1000 concurrent executions).
    """
    records = event.get("Records", [])
    results = []

    for record in records:
        body = json.loads(record["body"])
        job_id = body["job_id"]
        session_id = body["session_id"]

        logger.info("Processing outcome job %s (session=%s)", job_id, session_id)

        try:
            # Production implementation:
            # 1. import app.services.outcome_service
            # 2. Call outcome_service.process_outcome(text, servings, mode)
            # 3. Save cart to cache
            results.append({
                "job_id": job_id,
                "status": "completed",
                "session_id": session_id,
            })
        except Exception as exc:
            logger.error("Outcome job %s failed: %s", job_id, exc)
            results.append({
                "job_id": job_id,
                "status": "failed",
                "error": str(exc),
            })

    return {"statusCode": 200, "body": json.dumps(results)}


# ---------------------------------------------------------------------------
# Infrastructure-as-Code reference (what you'd deploy with AWS CLI/CDK)
# ---------------------------------------------------------------------------
"""
# Create SQS Queues
aws sqs create-queue --queue-name nowcart-vision-queue \
    --attributes '{
        "VisibilityTimeout": "60",
        "MessageRetentionPeriod": "86400",
        "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:ap-south-1:ACCOUNT:nowcart-dlq\",\"maxReceiveCount\":\"3\"}"
    }'

aws sqs create-queue --queue-name nowcart-share-queue \
    --attributes '{"VisibilityTimeout": "60", "MessageRetentionPeriod": "86400"}'

aws sqs create-queue --queue-name nowcart-outcome-queue \
    --attributes '{"VisibilityTimeout": "60", "MessageRetentionPeriod": "86400"}'

aws sqs create-queue --queue-name nowcart-dlq \
    --attributes '{"MessageRetentionPeriod": "1209600"}'

# Create Lambda Functions
aws lambda create-function --function-name nowcart-vision \
    --runtime python3.11 --handler lambda_handlers.vision_handler \
    --memory-size 256 --timeout 30 \
    --role arn:aws:iam::ACCOUNT:role/nowcart-lambda-role \
    --zip-file fileb://lambda_package.zip

aws lambda create-function --function-name nowcart-share \
    --runtime python3.11 --handler lambda_handlers.share_handler \
    --memory-size 256 --timeout 30 \
    --role arn:aws:iam::ACCOUNT:role/nowcart-lambda-role \
    --zip-file fileb://lambda_package.zip

# Wire SQS → Lambda triggers
aws lambda create-event-source-mapping \
    --function-name nowcart-vision \
    --event-source-arn arn:aws:sqs:ap-south-1:ACCOUNT:nowcart-vision-queue \
    --batch-size 1

aws lambda create-event-source-mapping \
    --function-name nowcart-share \
    --event-source-arn arn:aws:sqs:ap-south-1:ACCOUNT:nowcart-share-queue \
    --batch-size 1

# IAM Role for Lambda (needs DynamoDB, SQS, Secrets Manager access)
# Trust policy: lambda.amazonaws.com
# Policies: AmazonDynamoDBFullAccess, AmazonSQSFullAccess, SecretsManagerReadWrite
"""
