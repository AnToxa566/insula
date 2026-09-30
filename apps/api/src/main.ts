/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Cloud Run there is one proxy hop, so without this `req.ip` is the
  // proxy's address and every per-IP rate limit shares a single bucket.
  // Express's default (trust nothing) is kept when the value is 0, so a
  // client can never spoof X-Forwarded-For in local dev.
  const trustProxyHops = app.get(ConfigService).getOrThrow<number>('TRUST_PROXY_HOPS');
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }
  // No cookies are involved anywhere in this API (bearer access tokens,
  // refresh tokens carried in the JSON body) — so no `credentials: true`
  // is needed here, just the origin itself.
  app.enableCors({ origin: app.get(ConfigService).getOrThrow<string>('WEB_APP_URL') });
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Insula API')
      .setDescription('Insula backend API')
      .setVersion('0.0.1')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(`${globalPrefix}/docs`, app, swaggerDocument);

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
