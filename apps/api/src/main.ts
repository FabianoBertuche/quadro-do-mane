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

  // Health check endpoint (for Render.com health checks)
  const httpApp = app.getHttpAdapter().getInstance();
  httpApp.get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Força inicialização do EncryptionService para falhar rápido se a chave estiver errada
  app.get(EncryptionService);

  // Render assigns a random PORT; fallback to API_PORT for local dev
  const port = Number(process.env.PORT) || config.get<number>('API_PORT', 3001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚀 API running on http://0.0.0.0:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`📚 Swagger docs: http://0.0.0.0:${port}/api/docs`);
}
bootstrap();
