// src/common/auth-grpc.client.ts
// Cliente gRPC de catalog-service hacia auth-service.
//
// Es la primera comunicación directa entre dos microservicios de este proyecto
// (hasta ahora todo el tráfico nacía en el api-gateway). La necesita la carga
// masiva: el CSV identifica al docente por correo, pero las grabaciones se
// guardan con teacher_id y los usuarios viven en yousac_auth_db, a la que este
// servicio no tiene —ni debe tener— acceso directo.
//
// Sigue siendo gRPC con Protocol Buffers, nunca REST.
import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { credentials, Metadata } from '@grpc/grpc-js';
import { loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { join } from 'path';

export interface ResolvedTeacher {
  id: number;
  email: string;
  full_name: string;
  role_name: string;
  is_blocked: boolean;
}

@Injectable()
export class AuthGrpcClient implements OnModuleInit {
  private client: any;

  onModuleInit() {
    const definition = loadSync(join(__dirname, '..', '..', 'proto', 'auth.proto'), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto: any = loadPackageDefinition(definition).auth;
    const target = process.env.AUTH_GRPC_URL || 'auth-service:50052';

    this.client = new proto.AuthService(target, credentials.createInsecure());
    console.log(`✅ Cliente gRPC hacia auth-service (${target})`);
  }

  /**
   * Resuelve correo → docente para todo el archivo en UNA sola llamada.
   *
   * `userToken` es el JWT de quien subió el CSV, reenviado tal cual: la llamada
   * entre microservicios no viaja anónima ni con credenciales de servicio, así
   * que auth-service le aplica el mismo RBAC que a cualquier otro consumidor.
   */
  /**
   * Correos de los estudiantes inscritos, para avisarles de una nueva clase.
   *
   * Esta base guarda las inscripciones pero no los datos de contacto: los
   * usuarios viven en yousac_auth_db. Se resuelven todos los ids de una vez, así
   * un curso con cien inscritos provoca una única llamada y no cien.
   */
  async resolveStudentEmails(
    studentIds: number[],
    userToken: string,
  ): Promise<{ id: number; email: string; full_name: string }[]> {
    if (!studentIds.length) return [];

    const metadata = new Metadata();
    if (userToken) metadata.add('authorization', `Bearer ${userToken}`);

    return new Promise((resolve, reject) => {
      this.client.ResolveStudentEmails({ student_ids: studentIds }, metadata, (err: any, response: any) => {
        if (err) {
          return reject(
            new InternalServerErrorException(
              `No se pudo resolver los estudiantes contra auth-service: ${err.details || err.message}`,
            ),
          );
        }
        resolve(JSON.parse(response.json));
      });
    });
  }

  async resolveTeachersByEmail(
    emails: string[],
    userToken: string,
  ): Promise<ResolvedTeacher[]> {
    if (!emails.length) return [];

    const metadata = new Metadata();
    if (userToken) metadata.add('authorization', `Bearer ${userToken}`);

    return new Promise((resolve, reject) => {
      this.client.ResolveTeachersByEmail({ emails }, metadata, (err: any, response: any) => {
        if (err) {
          return reject(
            new InternalServerErrorException(
              `No se pudo resolver los docentes contra auth-service: ${err.details || err.message}`,
            ),
          );
        }
        resolve(JSON.parse(response.json));
      });
    });
  }
}
