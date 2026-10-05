import app from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import logger from './config/logger';

async function main() {
  await connectDatabase();
  const server = app.listen(env.port, () => {
    logger.info(`CRM API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
