// src/admin/admin.controller.ts
// Superficie gRPC del panel administrativo.
//
// RBAC: GrpcAuthGuard valida el JWT de la metadata y GrpcRolesGuard exige uno de
// los tres roles administrativos en CADA método, incluidas las lecturas — son
// rutas de administración, no catálogo público. El api-gateway ya filtró por rol
// antes de llegar acá; esta es la segunda barrera, porque el microservicio no
// confía en que el gateway sea el único que le puede hablar por gRPC.
import { Controller, UseGuards, UseFilters } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AdminService } from './admin.service';
import { GrpcAuthGuard } from '../middleware/grpc-auth.guard';
import { GrpcRolesGuard } from '../middleware/grpc-roles.guard';
import { Roles } from '../middleware/roles.decorator';
import { GrpcExceptionFilter } from '../middleware/grpc-exception.filter';

// Los tres roles que la Práctica 3 habilita para administrar el catálogo.
const ADMIN_ROLES = ['administrador', 'catedratico', 'auxiliar'];

@Controller()
@UseGuards(GrpcAuthGuard, GrpcRolesGuard)
@UseFilters(GrpcExceptionFilter)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Semestres ────────────────────────────────────────────────────────────

  @GrpcMethod('CatalogService', 'ListSemesters')
  @Roles(...ADMIN_ROLES)
  async listSemesters() {
    return { json: JSON.stringify(await this.adminService.listSemesters()) };
  }

  @GrpcMethod('CatalogService', 'CreateSemester')
  @Roles(...ADMIN_ROLES)
  async createSemester(data: any) {
    const result = await this.adminService.createSemester(
      data.name, data.year, data.code, data.is_active,
    );
    return { json: JSON.stringify(result) };
  }

  @GrpcMethod('CatalogService', 'UpdateSemester')
  @Roles(...ADMIN_ROLES)
  async updateSemester(data: any) {
    return this.adminService.updateSemester(
      data.id, data.name, data.year, data.code, data.is_active,
    );
  }

  @GrpcMethod('CatalogService', 'DeleteSemester')
  @Roles(...ADMIN_ROLES)
  async deleteSemester(data: { id: number }) {
    return this.adminService.deleteSemester(data.id);
  }

  // ── Escuelas / Áreas ─────────────────────────────────────────────────────

  @GrpcMethod('CatalogService', 'ListSchools')
  @Roles(...ADMIN_ROLES)
  async listSchools() {
    return { json: JSON.stringify(await this.adminService.listSchools()) };
  }

  @GrpcMethod('CatalogService', 'CreateSchool')
  @Roles(...ADMIN_ROLES)
  async createSchool(data: any) {
    const result = await this.adminService.createSchool(data.name, data.code);
    return { json: JSON.stringify(result) };
  }

  @GrpcMethod('CatalogService', 'UpdateSchool')
  @Roles(...ADMIN_ROLES)
  async updateSchool(data: any) {
    return this.adminService.updateSchool(data.id, data.name, data.code);
  }

  @GrpcMethod('CatalogService', 'DeleteSchool')
  @Roles(...ADMIN_ROLES)
  async deleteSchool(data: { id: number }) {
    return this.adminService.deleteSchool(data.id);
  }

  // ── Cursos ───────────────────────────────────────────────────────────────

  @GrpcMethod('CatalogService', 'ListCourses')
  @Roles(...ADMIN_ROLES)
  async listCourses(data: { school_id?: number; semester_id?: number }) {
    const courses = await this.adminService.listCourses(data.school_id, data.semester_id);
    return { json: JSON.stringify(courses) };
  }

  @GrpcMethod('CatalogService', 'CreateCourse')
  @Roles(...ADMIN_ROLES)
  async createCourse(data: any) {
    const result = await this.adminService.createCourse(
      data.name, data.code, data.school_id, data.semester_id,
    );
    return { json: JSON.stringify(result) };
  }

  @GrpcMethod('CatalogService', 'UpdateCourse')
  @Roles(...ADMIN_ROLES)
  async updateCourse(data: any) {
    return this.adminService.updateCourse(
      data.id, data.name, data.code, data.school_id, data.semester_id,
    );
  }

  @GrpcMethod('CatalogService', 'DeleteCourse')
  @Roles(...ADMIN_ROLES)
  async deleteCourse(data: { id: number }) {
    return this.adminService.deleteCourse(data.id);
  }

  // ── Asignaciones docente ↔ curso ─────────────────────────────────────────

  @GrpcMethod('CatalogService', 'ListCourseTeachers')
  @Roles(...ADMIN_ROLES)
  async listCourseTeachers(data: { id: number }) {
    const teachers = await this.adminService.listCourseTeachers(data.id);
    return { json: JSON.stringify(teachers) };
  }

  @GrpcMethod('CatalogService', 'AssignTeacher')
  @Roles(...ADMIN_ROLES)
  async assignTeacher(data: { teacher_id: number; course_id: number }) {
    return this.adminService.assignTeacher(data.teacher_id, data.course_id);
  }

  @GrpcMethod('CatalogService', 'UnassignTeacher')
  @Roles(...ADMIN_ROLES)
  async unassignTeacher(data: { teacher_id: number; course_id: number }) {
    return this.adminService.unassignTeacher(data.teacher_id, data.course_id);
  }
}
