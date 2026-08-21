# app/cache/redis_client.py
# Capa de caché con Redis para el microservicio de Analítica.
#
# Objetivo (Proyecto Fase 1): evitar que las consultas más frecuentes del catálogo
# y de tendencias golpeen MySQL durante los picos de concurrencia de época de
# exámenes.
#
# Principio de diseño: la caché es un acelerador, nunca un punto único de fallo.
# Si Redis no está disponible, cada operación degrada a "miss" y el servicio
# responde consultando la base. Por eso todos los métodos capturan la excepción
# de conexión en vez de propagarla.
import json
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Callable, Optional

import redis


def _json_default(obj: Any):
    """MySQL devuelve Decimal y fechas, que json no serializa por sí solo."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Tipo no serializable: {type(obj)}")


class RedisCache:
    """
    Envoltorio delgado sobre redis-py.

    Expone la operación que realmente se usa en el servicio —"devolveme esto de
    caché, y si no está, calculalo y guardalo"— en vez de un get/set crudo que
    obligaría a repetir el mismo patrón en cada consulta.
    """

    # TTL por familia de consulta. Las tendencias toleran datos algo viejos;
    # las métricas puntuales de un video se piden recién sincronizadas.
    TTL_TRENDS = 300      # 5 min  — rankings y tendencias
    TTL_CATALOG = 180     # 3 min  — consultas frecuentes del catálogo
    TTL_METRICS = 120     # 2 min  — métricas de un video o curso
    TTL_STATS = 60        # 1 min  — estadísticas globales del sistema

    PREFIX = "yousac:analytics"

    def __init__(self) -> None:
        self.host = os.getenv("REDIS_HOST", "redis")
        self.port = int(os.getenv("REDIS_PORT", "6379"))
        self.password = os.getenv("REDIS_PASSWORD") or None
        self.db = int(os.getenv("REDIS_DB", "0"))
        self._client: Optional[redis.Redis] = None
        self._connect()

    def _connect(self) -> None:
        try:
            self._client = redis.Redis(
                host=self.host,
                port=self.port,
                password=self.password,
                db=self.db,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
                health_check_interval=30,
            )
            self._client.ping()
            print(f"✅ Redis conectado en {self.host}:{self.port} (db {self.db})")
        except Exception as exc:
            # No se aborta el arranque: el servicio funciona sin caché.
            self._client = None
            print(f"⚠️  Redis no disponible ({exc}). El servicio seguirá sin caché.")

    @property
    def available(self) -> bool:
        if self._client is None:
            return False
        try:
            return bool(self._client.ping())
        except Exception:
            return False

    def key(self, *parts: Any) -> str:
        """Construye la clave con el prefijo del servicio."""
        return ":".join([self.PREFIX, *[str(p) for p in parts]])

    def get(self, key: str) -> Optional[Any]:
        if self._client is None:
            return None
        try:
            raw = self._client.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception as exc:
            print(f"⚠️  Error leyendo de Redis ({key}): {exc}")
            return None

    def set(self, key: str, value: Any, ttl: int) -> bool:
        if self._client is None:
            return False
        try:
            self._client.setex(key, ttl, json.dumps(value, default=_json_default))
            return True
        except Exception as exc:
            print(f"⚠️  Error escribiendo en Redis ({key}): {exc}")
            return False

    def get_or_set(self, key: str, ttl: int, producer: Callable[[], Any]) -> tuple[Any, bool]:
        """
        Devuelve `(valor, vino_de_cache)`.

        El segundo elemento no es decorativo: el gateway lo expone como cabecera
        `X-Cache: HIT|MISS`, que es la forma de evidenciar en la sustentación que
        Redis está realmente sirviendo tráfico y no solo levantado.
        """
        cached = self.get(key)
        if cached is not None:
            return cached, True

        value = producer()
        self.set(key, value, ttl)
        return value, False

    def invalidate(self, *patterns: str) -> int:
        """
        Borra por patrón. Se usa tras sincronizar métricas: los rankings dejan de
        ser válidos en cuanto cambian los datos que los alimentan.

        Usa SCAN y no KEYS porque KEYS bloquea el servidor mientras recorre todo
        el espacio de claves.
        """
        if self._client is None:
            return 0
        borradas = 0
        try:
            for pattern in patterns:
                for clave in self._client.scan_iter(match=pattern, count=100):
                    self._client.delete(clave)
                    borradas += 1
        except Exception as exc:
            print(f"⚠️  Error invalidando en Redis: {exc}")
        return borradas

    def stats(self) -> dict:
        """
        Estado de la caché. Sirve para la verificación de Redis que pide la
        sustentación: muestra claves vivas, aciertos, fallos y memoria usada.
        """
        if self._client is None:
            return {"available": False, "reason": "sin conexión a Redis"}
        try:
            info = self._client.info()
            hits = int(info.get("keyspace_hits", 0))
            misses = int(info.get("keyspace_misses", 0))
            total = hits + misses
            claves = list(self._client.scan_iter(match=f"{self.PREFIX}:*", count=200))

            return {
                "available": True,
                "host": f"{self.host}:{self.port}",
                "redis_version": info.get("redis_version"),
                "used_memory_human": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "keyspace_hits": hits,
                "keyspace_misses": misses,
                "hit_rate_percent": round(hits / total * 100, 2) if total else 0.0,
                "cached_keys": len(claves),
                "keys": [
                    {"key": k, "ttl_seconds": self._client.ttl(k)}
                    for k in sorted(claves)[:25]
                ],
            }
        except Exception as exc:
            return {"available": False, "reason": str(exc)}


# Instancia única para todo el servicio.
cache = RedisCache()
