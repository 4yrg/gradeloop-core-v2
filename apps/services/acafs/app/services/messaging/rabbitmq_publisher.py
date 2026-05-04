"""RabbitMQ publisher for submitting evaluation requests."""

import json

import pika
from pika.adapters.blocking_connection import BlockingChannel

from app.config import Settings
from app.logging_config import get_logger

logger = get_logger(__name__)


class RabbitMQPublisher:
    """Publisher for RabbitMQ submission events."""

    def __init__(self, settings: Settings):
        """Initialize RabbitMQ publisher.

        Args:
            settings: Application settings
        """
        self.settings = settings
        self._connection: pika.BlockingConnection | None = None
        self._channel: BlockingChannel | None = None

    def connect(self) -> None:
        """Establish connection to RabbitMQ."""
        params = pika.URLParameters(self.settings.rabbitmq_url)
        params.heartbeat = 600
        params.blocked_connection_timeout = 300

        self._connection = pika.BlockingConnection(params)
        self._channel = self._connection.channel()

        # Declare exchange
        self._channel.exchange_declare(
            exchange=self.settings.rabbitmq_exchange,
            exchange_type="topic",
            durable=True,
        )

        logger.info("rabbitmq_publisher_connected", url=self.settings.rabbitmq_url)

    def publish(self, routing_key: str, message: dict) -> bool:
        """Publish a message to RabbitMQ.

        Args:
            routing_key: Message routing key
            message: Message payload

        Returns:
            True if published successfully, False otherwise
        """
        if not self._channel:
            self.connect()

        try:
            self._channel.basic_publish(
                exchange=self.settings.rabbitmq_exchange,
                routing_key=routing_key,
                body=json.dumps(message, default=str),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Persistent
                    content_type="application/json",
                ),
            )
            logger.info("message_published", routing_key=routing_key)
            return True
        except Exception as e:
            logger.error("publish_failed", error=str(e), routing_key=routing_key)
            return False

    def close(self) -> None:
        """Close the connection."""
        if self._connection and self._connection.is_open:
            self._connection.close()
