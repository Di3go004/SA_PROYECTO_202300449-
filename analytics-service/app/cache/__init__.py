# app/cache/__init__.py
from .redis_client import cache, RedisCache

__all__ = ["cache", "RedisCache"]
