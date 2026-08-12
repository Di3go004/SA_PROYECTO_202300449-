// src/common/database.module.ts
import { Module, Global } from '@nestjs/common';
import { CatalogDatabaseService } from './database.service';

@Global()
@Module({
  providers: [CatalogDatabaseService],
  exports: [CatalogDatabaseService],
})
export class DatabaseModule {}
