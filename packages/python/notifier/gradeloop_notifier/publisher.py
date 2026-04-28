from __future__ import annotations

import json
import logging
from typing import Any

import pika
from pika.adapters.blocking_connection import BlockingChannel

from gradeloop_notifier.models import NOTIFICATION_EXCHANGE, NOTIFICATION_ROUTING_KEY, Notification

logger = logging.getLogger(__name__)


class NotificationPublisher:
    def __init__(self, rabbitmq_url: str = "amqp://guest:guest@localhost:5672/") -> None:
        self._url = rabbitmq_url
        self._connection: pika.BlockingConnection | None = None
        self._channel: BlockingChannel | None = None

    def connect(self) -> None:
        params = pika.URLParameters(self._url)
        self._connection = pika.BlockingConnection(params)
        self._channel = self._connection.channel()
        self._channel.confirm_delivery()
        self._declare_topology()
        logger.info("notifier: connected to RabbitMQ")

    def _declare_topology(self) -> None:
        assert self._channel is not None

        self._channel.exchange_declare(
            exchange=NOTIFICATION_EXCHANGE,
            exchange_type="topic",
            durable=True,
        )

        self._channel.queue_declare(
            queue="notification.process",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "notifications.dlx",
                "x-max-length": 100000,
            },
        )

        self._channel.exchange_declare(
            exchange="notifications.dlx",
            exchange_type="fanout",
            durable=True,
        )

        self._channel.queue_declare(
            queue="notification.process.dead",
            durable=True,
        )

        self._channel.queue_bind(
            queue="notification.process.dead",
            exchange="notifications.dlx",
            routing_key="",
        )

        self._channel.queue_bind(
            queue="notification.process",
            exchange=NOTIFICATION_EXCHANGE,
            routing_key=NOTIFICATION_ROUTING_KEY,
        )

    def publish(self, notification: Notification) -> None:
        if self._channel is None or self._channel.is_closed:
            self.connect()

        assert self._channel is not None

        body = notification.to_json()

        self._channel.basic_publish(
            exchange=NOTIFICATION_EXCHANGE,
            routing_key=NOTIFICATION_ROUTING_KEY,
            body=body,
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
                message_id=notification.id,
            ),
            mandatory=True,
        )

        logger.info(
            "notifier: published notification id=%s type=%s recipients=%d",
            notification.id,
            notification.type,
            len(notification.user_ids),
        )

    def close(self) -> None:
        if self._connection and self._connection.is_open:
            self._connection.close()
            logger.info("notifier: disconnected from RabbitMQ")

    def __enter__(self) -> NotificationPublisher:
        self.connect()
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()