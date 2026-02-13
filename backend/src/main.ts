import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe with class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Finans Backend API')
    .setDescription(
      `
News aggregation and financial data API.

## Features
- News from multiple sources (GDELT, SEC RSS, KAP, Google News)
- Ticker and tag filtering
- Full-text search
- Paginated responses

## Rate Limiting
- 120 requests per minute per IP

## Authentication
Currently no authentication required (read-only public API).
`,
    )
    .setVersion('1.0')
    .addTag('News', 'News listing and search endpoints')
    .addTag('Tickers', 'Ticker/symbol management')
    .addTag('Tags', 'Tag/category management')
    .addTag('Health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Finans API Docs',
    customfavIcon: 'https://swagger.io/favicon-32x32.png',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  // Prefer explicit PORT; default to 3001 for backend
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend running on http://localhost:${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
}
bootstrap();
