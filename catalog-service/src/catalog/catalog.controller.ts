// src/catalog/catalog.controller.ts
import { Controller, UseGuards, UseFilters } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CatalogService } from './catalog.service';
import { GrpcAuthGuard } from '../middleware/grpc-auth.guard';
import { GrpcExceptionFilter } from '../middleware/grpc-exception.filter';

@Controller()
@UseGuards(GrpcAuthGuard)
@UseFilters(GrpcExceptionFilter)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @GrpcMethod('CatalogService', 'GetCatalog')
  async getCatalog(data: any) {
    const user = { sub: data.__user.sub, role: data.__user.role };

    // proto3 entrega 0 / '' para los escalares ausentes; la función SQL espera
    // NULL para "sin filtro", así que la conversión se hace acá una sola vez.
    const num = (v: any) => (v ? Number(v) : null);
    const str = (v: any) => (v && String(v).trim() !== '' ? String(v).trim() : null);

    const filters = {
      semester:   str(data.semester),
      semesterId: num(data.semester_id),
      year:       num(data.year),
      schoolId:   num(data.school_id),
      courseId:   num(data.course_id),
      teacherId:  num(data.teacher_id),
      tag:        str(data.tag),
      search:     str(data.search),
    };

    const pagination = {
      page: data.page || 1,
      limit: data.limit || CatalogService.MAX_PAGE_SIZE,
    };

    const result = await this.catalogService.getCatalog(user, filters, pagination);
    return { json: JSON.stringify(result) };
  }

  @GrpcMethod('CatalogService', 'GetSchools')
  async getSchools() {
    const schools = await this.catalogService.getSchools();
    return { json: JSON.stringify(schools) };
  }

  @GrpcMethod('CatalogService', 'GetCourses')
  async getCourses(data: { school_id?: string }) {
    const courses = await this.catalogService.getCourses(data.school_id);
    return { json: JSON.stringify(courses) };
  }

  @GrpcMethod('CatalogService', 'GetRecordingById')
  async getRecording(data: { id: number; __user?: any }) {
    const user = { sub: data.__user.sub, role: data.__user.role };
    const recording = await this.catalogService.getRecordingById(data.id, user);
    return { json: JSON.stringify(recording) };
  }
}
