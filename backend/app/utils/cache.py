# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========

import hashlib
import json
import logging
from collections.abc import Callable
from typing import Any

from app.component.environment import env

logger = logging.getLogger("cache")

_redis_client = None
_redis_available = False


def _get_redis():
    """Lazy-init a shared Redis client (synchronous)."""
    global _redis_client, _redis_available
    if _redis_client is None:
        try:
            import redis as sync_redis

            redis_url = env("REDIS_URL", "redis://localhost:6379/0")
            _redis_client = sync_redis.from_url(
                redis_url,
                max_connections=10,
                decode_responses=True,
            )
            _redis_client.ping()
            _redis_available = True
            logger.info(
                "Redis cache connected",
                extra={"url": redis_url},
            )
        except Exception:
            logger.warning(
                "Redis cache unavailable — caching disabled",
                exc_info=True,
            )
            _redis_available = False
    return _redis_client if _redis_available else None


def cache_get(key: str) -> Any | None:
    """Get a value from the Redis cache. Returns None on miss or error."""
    try:
        r = _get_redis()
        if r is None:
            return None
        data = r.get(key)
        if data is not None:
            return json.loads(data)
    except Exception:
        logger.debug("Redis cache get failed", exc_info=True)
    return None


def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> None:
    """Set a value in the Redis cache with a TTL."""
    try:
        r = _get_redis()
        if r is None:
            return
        r.set(key, json.dumps(value), ex=ttl_seconds)
    except Exception:
        logger.debug("Redis cache set failed", exc_info=True)


def make_cache_key(prefix: str, *parts: str) -> str:
    """Build a deterministic cache key from a prefix and parts."""
    raw = ":".join(str(p) for p in parts)
    h = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{prefix}:{h}"


def cache_get_or_set(
    key: str,
    factory: Callable[[], Any],
    ttl_seconds: int = 300,
) -> Any:
    """Get from cache or compute + store (synchronous)."""
    cached = cache_get(key)
    if cached is not None:
        return cached
    value = factory()
    cache_set(key, value, ttl_seconds)
    return value
