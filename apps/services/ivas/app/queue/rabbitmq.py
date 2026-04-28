"""RabbitMQ publisher for sending notifications from the IVAS service.

Matches the JSON schema expected by the Go notification consumer at
packages/go/notifier/notifier.go, publishing to the same exchange
and routing key that the notification service consumes from.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import aio_pika
from aio_pika import ExchangeType

from app.logging_config import get_logger

logger = get_logger(__name__)

EXCHANGE_NAME = "notifications"
ROUTING_KEY = "notification.created"
QUEUE_NAME = "notification.process"
DLX_NAME = "notifications.dlx"
DEAD_QUEUE_NAME = "notification.process.dead"


class NotificationPublisher:
    """Async RabbitMQ publisher that sends notification messages.

    Declares the same topology as the Go notifier package so it works
    regardless of service startup order. Publishing is best-effort —
    failures are logged but never block the caller.
    """

    def __init__(self, url: str, iam_service_url: str = "") -> None:
        self._url = url
        self._iam_service_url = iam_service_url.rstrip("/") if iam_service_url else ""
        self._connection: aio_pika.RobustConnection | None = None
        self._channel: aio_pika.RobustChannel | None = None
        self._exchange: aio_pika.RobustExchange | None = None

    async def connect(self) -> None:
        """Connect to RabbitMQ and declare topology.

        Raises on failure so the caller knows connection didn't succeed.
        """
        self._connection = await aio_pika.connect_robust(self._url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=1)

        self._exchange = await self._channel.declare_exchange(
            EXCHANGE_NAME,
            ExchangeType.TOPIC,
            durable=True,
        )

        await self._channel.declare_exchange(
            DLX_NAME,
            ExchangeType.FANOUT,
            durable=True,
        )

        # Declare the dead-letter queue first (no special args).
        await self._channel.declare_queue(
            DEAD_QUEUE_NAME,
            durable=True,
        )

        # Declare the main processing queue with dead-letter and max-length
        # args. This must match exactly what the Go notification service
        # declares — if the queue already exists with different args RabbitMQ
        # will raise PRECONDITION_FAILED. Use passive=False (default) which
        # will succeed if args match or queue doesn't exist yet.
        queue = await self._channel.declare_queue(
            QUEUE_NAME,
            durable=True,
            arguments={
                "x-dead-letter-exchange": DLX_NAME,
                "x-max-length": 100000,
            },
        )
        await queue.bind(self._exchange, ROUTING_KEY)

        # Bind the dead-letter queue to the DLX.
        dead_queue = await self._channel.get_queue(DEAD_QUEUE_NAME)
        dlx_exchange = await self._channel.get_exchange(DLX_NAME)
        await dead_queue.bind(dlx_exchange, "")

        logger.info("ivas_rabbitmq_connected")

    async def close(self) -> None:
        """Close the RabbitMQ connection."""
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
            logger.info("ivas_rabbitmq_disconnected")

    async def publish_notification(
        self,
        user_ids: list[str],
        notif_type: str,
        title: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> bool:
        """Publish a notification message to RabbitMQ.

        Returns True if successful, False otherwise. Never raises.
        """
        if not self._connection or not self._exchange:
            logger.warning("ivas_notification_skipped_no_connection", type=notif_type)
            return False

        notification_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:8]
        payload = {
            "id": notification_id,
            "user_ids": user_ids,
            "type": notif_type,
            "title": title,
            "message": message,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            await self._exchange.publish(
                aio_pika.Message(
                    body=json.dumps(payload).encode(),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    message_id=notification_id,
                ),
                routing_key=ROUTING_KEY,
            )
            logger.info(
                "ivas_notification_published",
                id=notification_id,
                type=notif_type,
                recipients=len(user_ids),
            )
            return True
        except Exception as exc:
            logger.error("ivas_notification_publish_failed", error=str(exc))
            return False

    async def resolve_user_name(self, user_id: str) -> str:
        """Resolve a user ID to a display name via the IAM service.

        Returns the user's full name if available, otherwise falls back
        to the user ID string.
        """
        if not self._iam_service_url:
            return user_id

        try:
            import httpx

            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self._iam_service_url}/api/v1/iam/users/{user_id}",
                )
                if resp.status_code == 200:
                    user_data = resp.json()
                    full_name = (user_data.get("full_name") or "").strip()
                    if full_name:
                        return full_name
                    email = (user_data.get("email") or "").strip()
                    if email:
                        return email
        except Exception as exc:
            logger.warning("ivas_resolve_user_name_failed", user_id=user_id, error=str(exc))

        return user_id