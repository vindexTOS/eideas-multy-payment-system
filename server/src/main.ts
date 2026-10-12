import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const { port, apiPrefix, corsOrigins, env } = config.getOrThrow<AppConfig>('app');

  app.setGlobalPrefix(apiPrefix);
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  // Honours @Exclude() on entities, so passwordHash can never leak.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const swagger = new DocumentBuilder()
    .setTitle('Eideas Multi Payment System')
    .setDescription(
      'Payment terminals, companies and earnings. Money comes in over MQTT from terminals (and, later, from app balances); commissions are computed per device tariff and reported per calendar month.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`${apiPrefix}/docs`, app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`API [${env}] listening on :${port}/${apiPrefix} - docs at /${apiPrefix}/docs`);
}

void bootstrap();
