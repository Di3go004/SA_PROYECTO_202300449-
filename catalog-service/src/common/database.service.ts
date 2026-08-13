// src/common/database.service.ts
// Principio D: los módulos dependen de esta abstracción, no directamente de pg
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, types } from 'pg';

// node-postgres devuelve NUMERIC/DECIMAL (oid 1700) como string por defecto,
// para no perder precisión en valores gigantes. Acá no la necesitamos (son
// porcentajes/promedios) y el frontend espera number para poder usar .toFixed()
// y aritmética normal — lo parseamos una sola vez acá en vez de castear en cada
// componente que consuma el catálogo.
types.setTypeParser(1700, (val: string) => parseFloat(val));

@Injectable()
export class CatalogDatabaseService implements OnModuleInit, OnModuleDestroy {
  private catalogPool: Pool;

  onModuleInit() {
    this.catalogPool = new Pool({
      host:     process.env.CATALOG_DB_HOST || 'localhost',
      port:     parseInt(process.env.CATALOG_DB_PORT || '5432'),
      database: process.env.CATALOG_DB_NAME || 'yousac_catalog_db',
      user:     process.env.CATALOG_DB_USER || 'yousac',
      password: process.env.CATALOG_DB_PASS || 'yousac_secret',
    });
    console.log('✅ Conectado a yousac_catalog_db');
  }

  async onModuleDestroy() {
    await this.catalogPool.end();
  }

  async query(text: string, params?: any[]) {
    return this.catalogPool.query(text, params);
  }

  /**
   * Ejecuta `work` dentro de una única transacción sobre una sola conexión.
   *
   * La carga masiva lo necesita porque `query()` toma una conexión distinta del
   * pool en cada llamada: un BEGIN por ahí y un COMMIT por acá caerían en
   * conexiones diferentes y la transacción no existiría. Acá se reserva un
   * cliente, se opera siempre sobre él y se libera pase lo que pase.
   */
  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.catalogPool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
