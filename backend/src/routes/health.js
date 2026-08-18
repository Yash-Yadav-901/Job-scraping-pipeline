import express from 'express';
import * as db from '../db/index.js';

const router = express.Router();
const startTime = Date.now();

router.get('/', async (req, res) => {
  const dbOk = db.isConnected();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    db: dbOk ? 'ok' : 'disconnected',
  });
});

router.get('/stats', async (req, res) => {
  try {
    const [overall, sources, recentRuns] = await Promise.all([
      db.getStats(),
      db.getSources(),
      db.getRecentRuns(50),
    ]);

    res.json({
      overall,
      sources: sources.map((s) => ({
        id: s._id,
        name: s.name,
        totalJobsFetched: s.total_jobs_fetched,
        jobsLastRun: s.jobs_last_run,
        lastRunStatus: s.last_run_status,
        lastRunAt: s.last_run_at,
        consecutiveFailures: s.consecutive_failures,
      })),
      recentRuns: recentRuns.map((r) => ({
        id: r._id,
        source: r.source_name,
        sourceId: r.source_id,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        status: r.status,
        jobsFound: r.jobs_found,
        jobsNew: r.jobs_new,
        errorMessage: r.error_message,
        retries: r.retries,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
