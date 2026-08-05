import os
import redis
import logging

logger = logging.getLogger(__name__)

_redis_client = None

def get_redis():
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.ping()
            return _redis_client
        except redis.ConnectionError:
            pass # Try to reconnect

    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            # decode_responses=True makes it return strings instead of bytes
            _redis_client = redis.from_url(redis_url, decode_responses=True)
            _redis_client.ping()
            return _redis_client
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis at {redis_url}: {e}")
            _redis_client = None
    
    return None
