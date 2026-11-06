import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { EMULATOR_CONFIG, EmulatorConfig } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<EmulatorConfig>(EMULATOR_CONFIG);
  const logger = new Logger('Emulator');

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // The built UI, when present (docker). In development Vite serves it.
  const index = join(config.publicDir, 'index.html');
  if (existsSync(index)) {
    app.useStaticAssets(config.publicDir);
    // Client-side routes (/devices/:id) get the app shell.
    app.use((req: Request, res: Response, next: NextFunction) =>
      req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(index) : next(),
    );
  }

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Emulator on :${config.port} - UI at /, API at /api`);
}

void bootstrap();
