// src/import/import.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { AuthGrpcClient } from '../common/auth-grpc.client';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecreto_yousac_2026',
    }),
  ],
  controllers: [ImportController],
  providers: [ImportService, AuthGrpcClient],
})
export class ImportModule {}
