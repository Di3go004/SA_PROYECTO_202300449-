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
    const filters = {
      semester: data.semester || undefined,
      year: data.year || undefined,
      schoolId: data.school_id || undefined,
      courseId: data.course_id || undefined,
      teacherId: data.teacher_id || undefined,
      tag: data.tag || undefined,
      search: data.search || undefined,
    };
    const pagination = { page: data.page || 1, limit: data.limit || 20 };
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
