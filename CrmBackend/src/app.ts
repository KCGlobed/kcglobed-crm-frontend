import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import logger from './config/logger';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { sanitizeBody } from './middlewares/sanitize';
import { apiLimiter } from './middlewares/rateLimiters';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
    exposedHeaders: ['X-Unread-Count', 'Content-Disposition'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeBody);
app.use(
  morgan(env.isProduction ? 'combined' : 'dev', {
    stream: { write: (message: string) => logger.http?.(message.trim()) ?? logger.info(message.trim()) },
    skip: (req) => req.url === '/health',
  })
);

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK', status: 200, data: { uptime: process.uptime() } });
});

app.use('/api/v1', apiLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
