// src/common/database.service.ts
// Principio D: los módulos dependen de esta abstracción, no directamente de pg
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool, types } from 'pg';

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
}
