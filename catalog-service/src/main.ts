// src/main.ts
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
      package: 'catalog',
      protoPath: join(__dirname, '..', 'proto', 'catalog.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT || 50053}`,
      // keepCase: debe coincidir con el loader del gateway (ver auth-service/src/main.ts)
      loader: { keepCase: true },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT || 3003;
  await app.listen(port);
  console.log(`✅ Catalog gRPC server en puerto ${process.env.GRPC_PORT || 50053}`);
  console.log(`✅ Catalog-service HTTP (solo /health) en puerto ${port}`);
}
bootstrap();
