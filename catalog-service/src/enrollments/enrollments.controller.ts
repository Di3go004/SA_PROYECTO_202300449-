// src/enrollments/enrollments.controller.ts
import { Controller, UseGuards, UseFilters } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { EnrollmentsService } from './enrollments.service';
import { GrpcAuthGuard } from '../middleware/grpc-auth.guard';
import { GrpcRolesGuard } from '../middleware/grpc-roles.guard';
import { Roles } from '../middleware/roles.decorator';
import { GrpcExceptionFilter } from '../middleware/grpc-exception.filter';

@Controller()
@UseGuards(GrpcAuthGuard, GrpcRolesGuard)
@UseFilters(GrpcExceptionFilter)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @GrpcMethod('CatalogService', 'EnrollStudent')
  @Roles('administrador')
  async enrollStudent(data: { student_id: number; course_id: number; __user?: any }) {
    return this.enrollmentsService.enrollStudent(data.student_id, data.course_id, data.__user.sub);
  }

  @GrpcMethod('CatalogService', 'UnenrollStudent')
  @Roles('administrador')
  async unenrollStudent(data: { student_id: number; course_id: number }) {
    return this.enrollmentsService.unenrollStudent(data.student_id, data.course_id);
  }

  @GrpcMethod('CatalogService', 'GetMyCourses')
  @Roles('estudiante')
  async getMyCourses(data: { student_id?: number; __user?: any }) {
    // Igual que en la versión REST: el id sale del JWT verificado (__user.sub),
    // nunca del campo student_id del request (evita que un cliente pida cursos ajenos).
    const courses = await this.enrollmentsService.getStudentCourses(data.__user.sub);
    return { json: JSON.stringify(courses) };
  }
}
