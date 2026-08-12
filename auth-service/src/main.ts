import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // gRPC: única forma en que el api-gateway habla con este microservicio.
  // El HTTP que queda (app.listen abajo) es exclusivamente /health.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      protoPath: join(__dirname, '..', 'proto', 'auth.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT || 50052}`,
      // keepCase: el gateway también carga el .proto con keepCase:true — si no
      // coinciden, @grpc/proto-loader convierte full_name→fullName de un lado
      // y no del otro, y los campos llegan undefined al handler.
      loader: { keepCase: true },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`✅ Auth/Users gRPC server en puerto ${process.env.GRPC_PORT || 50052}`);
  console.log(`✅ Auth-service HTTP (solo /health) en puerto ${port}`);
}
bootstrap();
