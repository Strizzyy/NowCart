"""DynamoDB repository — durable backend for production (Requirement 9.3).

Uses aioboto3 for async access. Tables are auto-created on first use
(suitable for DynamoDB Local or fresh AWS accounts).

Only active when DATA_BACKEND=dynamodb in settings.
"""
from __future__ import annotations

import asyncio
import json
import logging
from decimal import Decimal
from typing import Any

import aioboto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.models.domain import Product, User, Order

logger = logging.getLogger(__name__)

# Table names
PRODUCTS_TABLE = "NowCart_Products"
USERS_TABLE = "NowCart_Users"
ORDERS_TABLE = "NowCart_Orders"


def _session_kwargs() -> dict[str, Any]:
    """Common kwargs for the aioboto3 DynamoDB resource."""
    kwargs: dict[str, Any] = {
        "region_name": settings.aws_region,
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
    }
    if settings.dynamodb_endpoint:
        kwargs["endpoint_url"] = settings.dynamodb_endpoint
    return kwargs


def _convert_floats(obj: Any) -> Any:
    """Recursively convert Python floats to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats(i) for i in obj]
    return obj


def _convert_decimals(obj: Any) -> Any:
    """Recursively convert Decimals back to float when reading from DynamoDB."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_decimals(i) for i in obj]
    return obj


class DynamoDBRepository:
    """DynamoDB-backed implementation of the Repository protocol."""

    def __init__(self) -> None:
        self._session = aioboto3.Session()
        self._tables_ensured = False

    async def _get_resource(self):  # noqa: ANN202
        """Create a DynamoDB resource context manager."""
        return self._session.resource("dynamodb", **_session_kwargs())

    async def create_tables_if_not_exist(self) -> None:
        """Ensure all required tables exist (idempotent). Waits for ACTIVE status."""
        if self._tables_ensured:
            return

        import asyncio

        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            existing = [t.name async for t in ddb.tables.all()]
            tables_created: list[str] = []

            if PRODUCTS_TABLE not in existing:
                await ddb.create_table(
                    TableName=PRODUCTS_TABLE,
                    KeySchema=[{"AttributeName": "product_id", "KeyType": "HASH"}],
                    AttributeDefinitions=[
                        {"AttributeName": "product_id", "AttributeType": "S"},
                        {"AttributeName": "category", "AttributeType": "S"},
                    ],
                    GlobalSecondaryIndexes=[
                        {
                            "IndexName": "category-index",
                            "KeySchema": [{"AttributeName": "category", "KeyType": "HASH"}],
                            "Projection": {"ProjectionType": "ALL"},
                        }
                    ],
                    BillingMode="PAY_PER_REQUEST",
                )
                tables_created.append(PRODUCTS_TABLE)
                logger.info("Created DynamoDB table: %s", PRODUCTS_TABLE)

            if USERS_TABLE not in existing:
                await ddb.create_table(
                    TableName=USERS_TABLE,
                    KeySchema=[{"AttributeName": "user_id", "KeyType": "HASH"}],
                    AttributeDefinitions=[
                        {"AttributeName": "user_id", "AttributeType": "S"},
                    ],
                    BillingMode="PAY_PER_REQUEST",
                )
                tables_created.append(USERS_TABLE)
                logger.info("Created DynamoDB table: %s", USERS_TABLE)

            if ORDERS_TABLE not in existing:
                await ddb.create_table(
                    TableName=ORDERS_TABLE,
                    KeySchema=[
                        {"AttributeName": "user_id", "KeyType": "HASH"},
                        {"AttributeName": "order_date", "KeyType": "RANGE"},
                    ],
                    AttributeDefinitions=[
                        {"AttributeName": "user_id", "AttributeType": "S"},
                        {"AttributeName": "order_date", "AttributeType": "S"},
                    ],
                    BillingMode="PAY_PER_REQUEST",
                )
                tables_created.append(ORDERS_TABLE)
                logger.info("Created DynamoDB table: %s", ORDERS_TABLE)

            # Wait for newly created tables to become ACTIVE
            if tables_created:
                logger.info("Waiting for tables to become ACTIVE: %s", tables_created)
                for table_name in tables_created:
                    # Use waiter via low-level client for reliable status check
                    for attempt in range(30):
                        try:
                            table = await ddb.Table(table_name)
                            await table.load()
                            status = table.table_status
                            if status == "ACTIVE":
                                break
                        except Exception:
                            pass
                        await asyncio.sleep(2)
                    logger.info("Table %s is ready", table_name)

        self._tables_ensured = True

    # --- Products ---

    async def get_product(self, product_id: str) -> Product | None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(PRODUCTS_TABLE)
            resp = await table.get_item(Key={"product_id": product_id})
            item = resp.get("Item")
            if not item:
                return None
            return Product(**_convert_decimals(item))

    async def list_products(
        self,
        category: str | None = None,
        search: str | None = None,
    ) -> list[Product]:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(PRODUCTS_TABLE)

            if category and not search:
                # Use the GSI for category filtering
                resp = await table.query(
                    IndexName="category-index",
                    KeyConditionExpression="category = :cat",
                    ExpressionAttributeValues={":cat": category},
                )
                items = resp.get("Items", [])
                # Handle pagination for GSI query
                while resp.get("LastEvaluatedKey"):
                    resp = await table.query(
                        IndexName="category-index",
                        KeyConditionExpression="category = :cat",
                        ExpressionAttributeValues={":cat": category},
                        ExclusiveStartKey=resp["LastEvaluatedKey"],
                    )
                    items.extend(resp.get("Items", []))
            else:
                # Full scan with pagination
                resp = await table.scan()
                items = resp.get("Items", [])
                while resp.get("LastEvaluatedKey"):
                    resp = await table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
                    items.extend(resp.get("Items", []))

            products = [Product(**_convert_decimals(item)) for item in items]

            if search:
                term = search.lower()
                products = [
                    p for p in products
                    if term in p.name.lower()
                    or term in p.category.lower()
                    or term in p.brand.lower()
                    or term in p.sub_category.lower()
                ]

            if category and search:
                cat_lower = category.lower()
                products = [p for p in products if p.category.lower() == cat_lower]

            return products

    async def upsert_product(self, product: Product) -> None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(PRODUCTS_TABLE)
            await table.put_item(Item=_convert_floats(product.model_dump()))

    async def bulk_upsert_products(self, products: list[Product]) -> None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(PRODUCTS_TABLE)
            total = len(products)
            async with table.batch_writer() as batch:
                for i, product in enumerate(products, 1):
                    await batch.put_item(Item=_convert_floats(product.model_dump()))
                    if i % 500 == 0:
                        logger.info("Batch write progress: %d/%d (%.0f%%)", i, total, i / total * 100)

    # --- Users ---

    async def get_user(self, user_id: str) -> User | None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(USERS_TABLE)
            resp = await table.get_item(Key={"user_id": user_id})
            item = resp.get("Item")
            if not item:
                return None
            return User(**_convert_decimals(item))

    async def upsert_user(self, user: User) -> None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(USERS_TABLE)
            await table.put_item(Item=_convert_floats(user.model_dump()))

    # --- Orders ---

    async def get_orders(self, user_id: str) -> list[Order]:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(ORDERS_TABLE)
            resp = await table.query(
                KeyConditionExpression="user_id = :uid",
                ExpressionAttributeValues={":uid": user_id},
                ScanIndexForward=False,  # newest first
            )
            items = resp.get("Items", [])
            return [Order(**_convert_decimals(item)) for item in items]

    async def upsert_order(self, order: Order) -> None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(ORDERS_TABLE)
            await table.put_item(Item=_convert_floats(order.model_dump()))
