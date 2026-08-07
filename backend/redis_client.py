import os
import redis
import logging

logger = logging.getLogger(__name__)

_redis_client = None

class MemoryRedis:
    def __init__(self):
        self.store = {}
    def ping(self):
        return True
    def setex(self, key, time, value):
        import time as t
        self.store[key] = (value, t.time() + time)
    def get(self, key):
        import time as t
        if key in self.store:
            val, exp = self.store[key]
            if t.time() < exp:
                return val
            else:
                del self.store[key]
        return None

# WARNING: memory:// backend is single-process only. Never use it with multiple workers/gunicorn processes.
def get_redis():
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.ping()
            return _redis_client
        except (redis.ConnectionError, Exception):
            pass # Try to reconnect

    redis_url = os.getenv("REDIS_URL")
    if redis_url == "memory://":
        if not isinstance(_redis_client, MemoryRedis):
            _redis_client = MemoryRedis()
        return _redis_client
    elif redis_url:
        try:
            # decode_responses=True makes it return strings instead of bytes
            _redis_client = redis.from_url(redis_url, decode_responses=True)
            _redis_client.ping()
            return _redis_client
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis at {redis_url}: {e}")
            if os.getenv("FLASK_ENV") == "production":
                raise RuntimeError(f"FATAL: Redis is required in production but unreachable: {e}")
            _redis_client = None
    
    return None
