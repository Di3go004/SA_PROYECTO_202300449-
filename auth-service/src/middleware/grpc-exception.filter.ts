// src/middleware/grpc-exception.filter.ts
// Traduce las excepciones HTTP de Nest (que los *.service.ts siguen lanzando sin
// cambios: BadRequestException, UnauthorizedException, ForbiddenException, etc.)
// a códigos de estado gRPC, para no tener que reescribir la capa de servicio.
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

    // Importante: no envolver de nuevo en RpcException. El pipeline de Nest para
    // microservicios espera aquí el error "desenvuelto" ({code, message} plano) —
    // lo mismo que exception.getError() devuelve en el patrón oficial de sus docs.
    // Envolverlo otra vez hace que grpc-js pierda el código y caiga en UNKNOWN(2).
    return throwError(() => ({ code, message }));
  }
}
