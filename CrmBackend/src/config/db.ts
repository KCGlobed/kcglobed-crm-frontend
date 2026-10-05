import mongoose from 'mongoose';
import { env } from './env';
import logger from './logger';

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  await mongoose.connect(env.mongoUri, {
    dbName: env.dbName,
    serverSelectionTimeoutMS: 15000,
  });
  logger.info(`MongoDB connected (db: ${env.dbName})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
