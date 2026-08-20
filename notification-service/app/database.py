# app/database.py
# Acceso a yousac_notifications_db.
#
# Se usa psycopg2 con SQL explícito y no un ORM: el enunciado prohíbe ORMs
# abstractos y toda escritura pasa por procedimientos almacenados.
import os
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool


class Database:
    """Principio D: los módulos dependen de esta abstracción, no de psycopg2."""

    def __init__(self) -> None:
        self.config = {
            "host": os.getenv("NOTIF_DB_HOST", "postgres-db"),
            "port": int(os.getenv("NOTIF_DB_PORT", "5432")),
            "dbname": os.getenv("NOTIF_DB_NAME", "yousac_notifications_db"),
            "user": os.getenv("NOTIF_DB_USER", "yousac"),
            "password": os.getenv("NOTIF_DB_PASS", "yousac_secret"),
        }
        self._pool = None

    def connect(self) -> None:
        self._pool = SimpleConnectionPool(minconn=1, maxconn=10, **self.config)
        print(f"✅ Conectado a {self.config['dbname']}")

    def close(self) -> None:
        if self._pool:
            self._pool.closeall()

    @contextmanager
    def cursor(self, commit: bool = False):
        """
        Presta una conexión del pool y la devuelve pase lo que pase.

        `commit=True` para las operaciones que escriben; las lecturas no lo
        necesitan y así no se marcan transacciones de más.
        """
        if self._pool is None:
            self.connect()

        conn = self._pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur
            if commit:
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.putconn(conn)


db = Database()
