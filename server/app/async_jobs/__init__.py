"""Async Jobs — Lambda + SQS offloading for heavy operations.

Architecture:
    API endpoint → SQS Queue → Lambda Function → DynamoDB (result)
    Frontend polls GET /api/cart/{session_id} for completion.

This module provides:
- SQS message publishing (send work to queues)
- Lambda handler stubs (the code that runs in Lambda)
- Job status tracking

In the hackathon prototype, these run synchronously in-process.
In production, heavy operations (vision analysis, recipe parsing,
large cart decompositions) are offloaded to Lambda for auto-scaling.
"""
