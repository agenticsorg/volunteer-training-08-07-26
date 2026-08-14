import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { logger } from './observability/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.info({ port }, 'Application started');
}

bootstrap().catch(err => {
  logger.error(err, 'Bootstrap error');
  process.exit(1);
});
