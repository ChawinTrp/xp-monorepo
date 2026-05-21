// Load .env in dev; Cloud Run injects env vars directly in production
if (process.env.NODE_ENV !== 'production') {
  const { config } = require('dotenv');
  const { join } = require('path');
  config({ path: join(__dirname, '..', '.env') });
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
