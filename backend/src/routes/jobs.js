import express from 'express';
import * as db from '../db/index.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const source = req.query.source || null;
    const q      = req.query.q || req.query.tag || null;

    const { jobs, total } = await db.getJobs({ source, q, limit, offset });

    const jobsOut = jobs.map((j) => ({
      ...j,
      id:     j._id,
      remote: Boolean(j.remote),
      tags:   Array.isArray(j.tags) ? j.tags : [],
    }));

    res.json({
      data: jobsOut,
      pagination: {
        page, limit, total,
        totalPages:  Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await db.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ ...job, id: job._id, remote: Boolean(job.remote) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
