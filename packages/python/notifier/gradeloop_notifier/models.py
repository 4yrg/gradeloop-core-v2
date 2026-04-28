from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


NOTIFICATION_EXCHANGE = "notifications"
NOTIFICATION_ROUTING_KEY = "notification.created"


@dataclass
class Notification:
    user_ids: list[str]
    type: str
    title: str
    message: str
    data: dict[str, Any] | None = None
    id: str = field(default_factory=lambda: f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}")
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Notification:
        return cls(
            user_ids=data.get("user_ids", []),
            type=data["type"],
            title=data["title"],
            message=data["message"],
            data=data.get("data"),
            id=data.get("id", ""),
            timestamp=data.get("timestamp", ""),
        )

    @classmethod
    def from_json(cls, json_str: str) -> Notification:
        return cls.from_dict(json.loads(json_str))