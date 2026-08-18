import cron from 'node-cron';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import sourceDefs from '../config/sources.js';
import * as db from '../db/index.js';
import { getBreaker, getState } from './circuitBreaker.js';
import { fetchForSource } from './adapters/index.js';
import { normalize } from '../normalizer/index.js';
import { runId } from '../utils/hash.js';

const cronTasks = [];

export async function runSource(source) {
  const rid = runId(source.id);
  const summary = {
    runId: rid,
    sourceId: source.id,
    status: 'ok',
    jobsFound: 0,
    jobsNew: 0,
    retries: 0,
    error: null,
  };

  logger.info({ sourceId: source.id, runId: rid }, 'Starting ingestion run');
  await db.insertRun({ id: rid, source_id: source.id });

  try {
    const breaker = getBreaker(source.id, async () => {
      const rawItems = await fetchForSource(source);
      return normalize(rawItems, source);
    });

    const jobs = await breaker.fire();

    summary.jobsFound = jobs.length;

    if (jobs.length > 0) {
      summary.jobsNew = await db.bulkInsertJobs(jobs);
    }

    logger.info(
      { sourceId: source.id, jobsFound: jobs.length, jobsNew: summary.jobsNew },
      'Ingestion run complete'
    );

    await db.updateSourceStatus({
      id: source.id,
      circuit_state: getState(source.id),
      last_run_status: 'ok',
      jobs_last_run: summary.jobsFound,
      jobs_new: summary.jobsNew,
      consecutive_failures: 0,
    });

  } catch (err) {
    summary.status = 'error';
    summary.error = err.message;

    logger.error({ sourceId: source.id, runId: rid, err: err.message }, 'Ingestion run failed');

    const prevSource = await db.getSourceById(source.id).catch(() => null);
    const prevFailures = prevSource?.consecutive_failures || 0;

    await db.updateSourceStatus({
      id: source.id,
      circuit_state: getState(source.id),
      last_run_status: 'error',
      jobs_last_run: 0,
      jobs_new: 0,
      consecutive_failures: prevFailures + 1,
    });
  } finally {
    await db.finalizeRun({
      id: rid,
      status: summary.status,
      jobs_found: summary.jobsFound,
      jobs_new: summary.jobsNew,
      error_message: summary.error,
      retries: summary.retries,
    });
  }

  return summary;
}

export function startScheduler() {
  const enabledSources = sourceDefs.filter((s) => s.enabled);
  logger.info({ count: enabledSources.length }, 'Starting ingestion scheduler');

  for (const source of enabledSources) {
    const initialDelay = Math.floor(Math.random() * 60_000);

    setTimeout(() => {
      runSource(source).catch((err) =>
        logger.error({ sourceId: source.id, err: err.message }, 'Initial run failed')
      );

      const task = cron.schedule(config.ingest.cron, () => {
        runSource(source).catch((err) =>
          logger.error({ sourceId: source.id, err: err.message }, 'Scheduled run failed')
        );
      });

      cronTasks.push(task);
      logger.info({ sourceId: source.id, cron: config.ingest.cron, initialDelayMs: initialDelay }, 'Source scheduled');
    }, initialDelay);
  }
}

export async function triggerIngest(sourceId = null) {
  const targets = sourceId
    ? sourceDefs.filter((s) => s.id === sourceId && s.enabled)
    : sourceDefs.filter((s) => s.enabled);

  if (targets.length === 0) throw new Error(`No enabled source found for id: ${sourceId}`);

  const results = [];
  for (const source of targets) {
    const result = await runSource(source);
    results.push(result);
  }
  return results;
}

export function stopScheduler() {
  logger.info('Stopping ingestion scheduler');
  for (const task of cronTasks) task.stop();
}
