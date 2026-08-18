import express from 'express';
import { triggerIngest } from '../ingestion/orchestrator.js';
import logger from '../utils/logger.js';

const router = express.Router();
let ingesting = false;

router.post('/', async (req, res) => {
  if (ingesting) {
    return res.status(429).json({
      error: 'An ingestion run is already in progress. Try again in a moment.',
    });
  }

  const { source } = req.body;
  ingesting = true;

  try {
    logger.info({ source: source || 'all' }, 'Manual ingest triggered');
    const results = await triggerIngest(source || null);

    res.json({
      message: 'Ingestion complete',
      runs: results,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Manual ingest failed');
    res.status(500).json({ error: err.message });
  } finally {
    ingesting = false;
  }
});

export default router;
