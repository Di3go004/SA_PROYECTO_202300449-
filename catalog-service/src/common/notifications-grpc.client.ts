// src/common/notifications-grpc.client.ts
// Cliente gRPC de catalog-service hacia notification-service.
//
// Se usa al publicar una grabación para avisar a los estudiantes inscritos. Igual
// que en auth-service, el aviso es un efecto secundario: si el servicio de
// notificaciones está caído, la grabación queda publicada de todas formas.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { join } from 'path';

@Injectable()
export class NotificationsGrpcClient implements OnModuleInit {
  private client: any;

  onModuleInit() {
    const definition = loadSync(join(__dirname, '..', '..', 'proto', 'notifications.proto'), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto: any = loadPackageDefinition(definition).notifications;
    const target = process.env.NOTIFICATIONS_GRPC_URL || 'notification-service:50055';

    this.client = new proto.NotificationService(target, credentials.createInsecure());
    console.log(`✅ Cliente gRPC hacia notification-service (${target})`);
  }

  /**
   * Avisa de una clase recién publicada. No devuelve promesa: quien publica no
   * espera al correo.
   */
  notifyNewRecording(payload: {
    recordingId: number;
    title: string;
    courseName: string;
    courseCode: string;
    teacherName: string;
    recipients: string[];
  }): void {
    if (!this.client || payload.recipients.length === 0) return;

    this.client.SendNewRecordingAlert(
      {
        recording_id: payload.recordingId,
        title: payload.title,
        course_name: payload.courseName,
        course_code: payload.courseCode,
        teacher_name: payload.teacherName,
        recipients: payload.recipients,
      },
      (err: any, response: any) => {
        if (err) {
          console.warn(`⚠️  No se pudo encolar el aviso de la grabación ${payload.recordingId}: ${err.details || err.message}`);
          return;
        }
        console.log(`✉️  Aviso de nueva clase: ${response.message}`);
      },
    );
  }
}
