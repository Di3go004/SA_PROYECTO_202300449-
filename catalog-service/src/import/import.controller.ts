// src/import/import.controller.ts
import { Controller, UseGuards, UseFilters } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ImportService } from './import.service';
import { GrpcAuthGuard } from '../middleware/grpc-auth.guard';
import { GrpcRolesGuard } from '../middleware/grpc-roles.guard';
import { Roles } from '../middleware/roles.decorator';
import { GrpcExceptionFilter } from '../middleware/grpc-exception.filter';

const ADMIN_ROLES = ['administrador', 'catedratico', 'auxiliar'];

@Controller()
@UseGuards(GrpcAuthGuard, GrpcRolesGuard)
@UseFilters(GrpcExceptionFilter)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @GrpcMethod('CatalogService', 'BulkImportRecordings')
  @Roles(...ADMIN_ROLES)
  async bulkImport(data: any) {
    // uploaded_by sale del JWT verificado, nunca del request: así nadie puede
    // atribuirle una carga a otro usuario.
    const summary = await this.importService.importRecordings(
      data.filename,
      data.csv_content,
      data.__user.sub,
      data.__token,
    );
    return { json: JSON.stringify(summary) };
  }

  @GrpcMethod('CatalogService', 'ListImportBatches')
  @Roles(...ADMIN_ROLES)
  async listBatches() {
    return { json: JSON.stringify(await this.importService.listBatches()) };
  }

  @GrpcMethod('CatalogService', 'GetImportBatch')
  @Roles(...ADMIN_ROLES)
  async getBatch(data: { id: number }) {
    return { json: JSON.stringify(await this.importService.getBatch(data.id)) };
  }
}
