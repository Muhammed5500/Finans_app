import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import cryptoRoutes from './routes/cryptoRoutes';
import bistRoutes from './routes/bistRoutes';
import usRoutes from './routes/usRoutes';
import newsRoutes from './routes/newsRoutes';
import marketsRoutes from './routes/marketsRoutes';
import yahooRoutes from './routes/yahooRoutes';
import aiRoutes from './routes/aiRoutes';
import authRoutes from './routes/authRoutes';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { AppError } from './utils/errors';
import { swaggerSpec } from './docs/swagger';

const app = express();

// Security
app.use(helmet());
app.use(cors());

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Finans Takip API Docs',
}));

// Routes
app.use(routes);                                    // /health (no rate limit)
app.use('/api/crypto', apiRateLimiter, cryptoRoutes); // /api/crypto/* (rate limited)
app.use('/api/bist', apiRateLimiter, bistRoutes);     // /api/bist/* (rate limited)
app.use('/api/us', apiRateLimiter, usRoutes);         // /api/us/* (rate limited)
app.use('/api/news', apiRateLimiter, newsRoutes);     // /api/news/* (rate limited)
app.use('/api/markets', apiRateLimiter, marketsRoutes); // /api/markets/* (rate limited)
app.use('/api/yahoo', apiRateLimiter, yahooRoutes);     // /api/yahoo/* (rate limited)
app.use('/api/ai', apiRateLimiter, aiRoutes);           // /api/ai/* (rate limited)
app.use('/api/auth', apiRateLimiter, authRoutes);       // /api/auth/* (rate limited)

// 404 handler
app.use((_req, _res, next) =>
  next(new AppError(404, 'Not Found', 'NOT_FOUND'))
);

// Error handler
app.use(errorHandler);

export default app;
