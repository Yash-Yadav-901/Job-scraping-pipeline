import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import sourceDefs from '../config/sources.js';
import { Job, Source, IngestRun } from './models.js';

export async function connectDB() {
    if (!config.mongoUri) {
        throw new Error('MONGODB_URI is not set in environment variables.');
    }

    await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 10000,
    });

    logger.info('Connected to MongoDB Atlas');


    for (const s of sourceDefs) {
        await Source.findOneAndUpdate(
            { _id: s.id },
            {
                $set: { name: s.name, url: s.url, type: s.type, enabled: s.enabled, description: s.description || '' },
                $setOnInsert: { circuit_state: 'CLOSED', consecutive_failures: 0, jobs_last_run: 0, total_jobs_fetched: 0 },
            },
            { upsert: true, new: true }
        );
    }

    logger.info({ count: sourceDefs.length }, 'Sources seeded');
}



export async function bulkInsertJobs(jobs) {
    if (!jobs.length) return 0;
    try {
        const result = await Job.insertMany(jobs, { ordered: false });
        return result.length;
    } catch (err) {
        if (err.code === 11000 || err.name === 'BulkWriteError') {
            return err.insertedDocs?.length ?? err.result?.nInserted ?? 0;
        }
        throw err;
    }
}

export async function getJobs({ source, q, limit, offset }) {
    const filter = {};
    if (source) filter.source_id = source;
    if (q) filter.$text = { $search: q };

    const [jobs, total] = await Promise.all([
        Job.find(filter).sort({ fetched_at: -1 }).skip(offset).limit(limit).lean(),
        Job.countDocuments(filter),
    ]);

    return { jobs, total };
}

export async function getJobById(id) {
    return Job.findById(id).lean();
}

export async function getSources() {
    return Source.find().sort({ name: 1 }).lean();
}

export async function getSourceById(id) {
    return Source.findById(id).lean();
}

export async function updateSourceStatus({ id, circuit_state, last_run_status, jobs_last_run, jobs_new, consecutive_failures }) {
    await Source.findByIdAndUpdate(id, {
        $set: {
            circuit_state,
            last_run_at: new Date(),
            last_run_status,
            jobs_last_run,
            consecutive_failures,
        },
        $inc: { total_jobs_fetched: jobs_new },
    });
}

export async function insertRun({ id, source_id }) {
    await IngestRun.create({ _id: id, source_id, status: 'running', started_at: new Date() });
}

export async function finalizeRun({ id, status, jobs_found, jobs_new, error_message, retries }) {
    await IngestRun.findByIdAndUpdate(id, {
        $set: { status, jobs_found, jobs_new, error_message, retries, finished_at: new Date() },
    });
}

export async function getRecentRuns(limit = 50) {
    const runs = await IngestRun.find().sort({ started_at: -1 }).limit(limit).lean();
    const sourceIds = [...new Set(runs.map((r) => r.source_id))];
    const sources = await Source.find({ _id: { $in: sourceIds } }).lean();
    const sourceMap = Object.fromEntries(sources.map((s) => [s._id, s.name]));
    return runs.map((r) => ({ ...r, source_name: sourceMap[r.source_id] || r.source_id }));
}

export async function getStats() {
    const [total_jobs, runs, sources_with_jobs] = await Promise.all([
        Job.countDocuments(),
        IngestRun.aggregate([
            {
                $group: {
                    _id: null,
                    total_runs: { $sum: 1 },
                    successful_runs: { $sum: { $cond: [{ $eq: ['$status', 'ok'] }, 1, 0] } },
                    failed_runs: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                },
            },
        ]),
        Job.distinct('source_id'),
    ]);

    const r = runs[0] || { total_runs: 0, successful_runs: 0, failed_runs: 0 };
    return {
        total_jobs,
        total_runs: r.total_runs,
        successful_runs: r.successful_runs,
        failed_runs: r.failed_runs,
        active_sources: sources_with_jobs.length,
    };
}

export function isConnected() {
    return mongoose.connection.readyState === 1;
}
