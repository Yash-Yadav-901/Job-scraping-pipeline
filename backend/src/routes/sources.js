import express from 'express';
import * as db from '../db/index.js';
import { getState, getStats } from '../ingestion/circuitBreaker.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const sources = await db.getSources();
    const enriched = sources.map((s) => ({
      ...s,
      id: s._id,
      circuit_state: getState(s._id),
      circuit_stats: getStats(s._id),
    }));
    res.json({ data: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const source = await db.getSourceById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    res.json({ ...source, id: source._id, circuit_state: getState(source._id), circuit_stats: getStats(source._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
