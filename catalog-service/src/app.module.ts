// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './common/database.module';
import { CatalogModule } from './catalog/catalog.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { AdminModule } from './admin/admin.module';
import { ImportModule } from './import/import.module';

@Module({
  imports: [
    DatabaseModule,
    CatalogModule,
    EnrollmentsModule,
    AdminModule,
    ImportModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
