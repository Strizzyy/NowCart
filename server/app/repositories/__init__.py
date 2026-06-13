"""Repositories — data access behind one interface (Requirement 8.4, 9.3).

Planned modules (task 2):
- base       Repository protocol (products, users, orders)
- memory     in-process dict store (default; app always runs)
- dynamodb   DynamoDB-backed repo (durable; .env upgrade)
- cache      Redis cache + stock override, with in-memory fallback
"""
