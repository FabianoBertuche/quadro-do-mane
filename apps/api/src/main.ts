import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { EncryptionService } from './common/crypto/encryption.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS dinâmico a partir do env (CORS_ORIGINS é uma lista separada por vírgula)
  const config = app.get(ConfigService);
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Validação global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Quadro do Mané API')
    .setDescription('SaaS Task Management Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Força inicialização do EncryptionService para falhar rápido se a chave estiver errada
  app.get(EncryptionService);

  const port = config.get<number>('API_PORT', 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API running on http://localhost:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
