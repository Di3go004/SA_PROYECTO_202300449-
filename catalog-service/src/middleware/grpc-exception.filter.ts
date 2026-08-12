// src/middleware/grpc-exception.filter.ts
// Traduce las excepciones HTTP de Nest (catalog.service.ts / enrollments.service.ts
// siguen lanzando BadRequestException, ForbiddenException, NotFoundException sin
// cambios) a códigos de estado gRPC.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Observable, throwError } from 'rxjs';

const HTTP_TO_GRPC: Record<number, number> = {
  400: GrpcStatus.INVALID_ARGUMENT,
  401: GrpcStatus.UNAUTHENTICATED,
  403: GrpcStatus.PERMISSION_DENIED,
  404: GrpcStatus.NOT_FOUND,
  409: GrpcStatus.ALREADY_EXISTS,
  500: GrpcStatus.INTERNAL,
};

@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, _host: ArgumentsHost): Observable<any> {
    let code = GrpcStatus.UNKNOWN;
    let message = 'Error interno';

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      code = HTTP_TO_GRPC[httpStatus] ?? GrpcStatus.UNKNOWN;
      const response = exception.getResponse();
      message =
        typeof response === 'string'
          ? response
          : (response as any)?.message || exception.message;
      if (Array.isArray(message)) message = message.join(', ');
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Ver comentario equivalente en auth-service: no envolver otra vez en
    // RpcException o grpc-js pierde el código y cae en UNKNOWN(2).
    return throwError(() => ({ code, message }));
  }
}
