// src/common/notifications-grpc.client.ts
// Cliente gRPC de auth-service hacia notification-service.
//
// El correo de bienvenida es un efecto secundario del registro, no parte de él:
// si el servicio de notificaciones está caído, el usuario igual queda registrado.
// Por eso cada llamada captura su propio error y nunca lo propaga.
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
   * Dispara el correo de bienvenida sin bloquear al llamador.
   *
   * No devuelve promesa a propósito: quien registra un usuario no debe esperar
   * al correo ni enterarse de si falló. El servicio de notificaciones ya deja
   * constancia del intento en su propia bitácora.
   */
  sendWelcomeEmail(email: string, fullName: string, role: string): void {
    if (!this.client) return;

    this.client.SendWelcomeEmail(
      { email, full_name: fullName, role },
      (err: any, response: any) => {
        if (err) {
          console.warn(`⚠️  No se pudo encolar el correo de bienvenida para ${email}: ${err.details || err.message}`);
          return;
        }
        console.log(`✉️  Bienvenida encolada para ${email} (notificación ${response.notification_id})`);
      },
    );
  }
}
