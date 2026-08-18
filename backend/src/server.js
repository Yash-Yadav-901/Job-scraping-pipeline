import 'dotenv/config';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

import config from './config/index.js';
import logger from './utils/logger.js';
import { connectDB } from './db/index.js';
import { startScheduler, stopScheduler } from './ingestion/orchestrator.js';


import jobsRouter from './routes/jobs.js';
import ingestRouter from './routes/ingest.js';
import sourcesRouter from './routes/sources.js';
import healthRouter from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();


app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

if (config.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, url: req.url }, 'Incoming request');
    next();
  });
}


app.use(express.static(join(__dirname, '..', 'public')));


app.use('/api/health', healthRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api', healthRouter);   // exposes /api/stats


app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    return res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  }
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, _next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});


async function boot() {
  try {
    await connectDB();

    const server = app.listen(config.port, () => {
      logger.info(
        { port: config.port, env: config.nodeEnv },
        `Job Ingestion Pipeline running at http://localhost:${config.port}`
      );
    });

    startScheduler();

    function shutdown(signal) {
      logger.info({ signal }, 'Shutting down...');
      stopScheduler();
      server.close(async () => {
        await mongoose.disconnect();
        logger.info('Goodbye.');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000);
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error({ err: err.message }, 'Failed to connect to MongoDB — exiting');
    process.exit(1);
  }
}

boot();

export default app;
