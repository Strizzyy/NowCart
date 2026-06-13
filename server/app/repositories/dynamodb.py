"""DynamoDB repository — durable backend for production (Requirement 9.3).

Uses aioboto3 for async access. Tables are auto-created on first use
(suitable for DynamoDB Local or fresh AWS accounts).

Only active when DATA_BACKEND=dynamodb in settings.
"""
from __future__ import annotations

import logging
from typing import Any

import aioboto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.models.domain import Product, User, Order

logger = logging.getLogger(__name__)

# Table names
PRODUCTS_TABLE = "Products"
USERS_TABLE = "Users"
ORDERS_TABLE = "Orders"


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


class DynamoDBRepository:
    """DynamoDB-backed implementation of the Repository protocol."""

    def __init__(self) -> None:
        self._session = aioboto3.Session()
        self._tables_ensured = False

    async def _get_resource(self):  # noqa: ANN202
        """Create a DynamoDB resource context manager."""
        return self._session.resource("dynamodb", **_session_kwargs())

    async def create_tables_if_not_exist(self) -> None:
        """Ensure all required tables exist (idempotent)."""
        if self._tables_ensured:
            return

        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            existing = [t.name async for t in ddb.tables.all()]

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
                            "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
                        }
                    ],
                    ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
                )
                logger.info("Created DynamoDB table: %s", PRODUCTS_TABLE)

            if USERS_TABLE not in existing:
                await ddb.create_table(
                    TableName=USERS_TABLE,
                    KeySchema=[{"AttributeName": "user_id", "KeyType": "HASH"}],
                    AttributeDefinitions=[
                        {"AttributeName": "user_id", "AttributeType": "S"},
                    ],
                    ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
                )
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
                    ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
                )
                logger.info("Created DynamoDB table: %s", ORDERS_TABLE)

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
            return Product(**item)

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
            else:
                # Full scan (acceptable for ~500 product catalog)
                resp = await table.scan()
                items = resp.get("Items", [])

            products = [Product(**item) for item in items]

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
            await table.put_item(Item=product.model_dump())

    async def bulk_upsert_products(self, products: list[Product]) -> None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(PRODUCTS_TABLE)
            async with table.batch_writer() as batch:
                for product in products:
                    await batch.put_item(Item=product.model_dump())

    # --- Users ---

    async def get_user(self, user_id: str) -> User | None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(USERS_TABLE)
            resp = await table.get_item(Key={"user_id": user_id})
            item = resp.get("Item")
            if not item:
                return None
            return User(**item)

    async def upsert_user(self, user: User) -> None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(USERS_TABLE)
            await table.put_item(Item=user.model_dump())

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
            return [Order(**item) for item in items]

    async def upsert_order(self, order: Order) -> None:
        await self.create_tables_if_not_exist()
        async with self._session.resource("dynamodb", **_session_kwargs()) as ddb:
            table = await ddb.Table(ORDERS_TABLE)
            await table.put_item(Item=order.model_dump())
