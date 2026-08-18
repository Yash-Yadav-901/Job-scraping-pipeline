import axios from 'axios';
import logger from '../../utils/logger.js';
import identityManager from '../identityManager.js';
import rateLimiter from '../rateLimiter.js';
import { withRetry } from '../retryEngine.js';
import config from '../../config/index.js';

const MAX_PAGES = 5;

export async function fetchJSON(source) {
  const allItems = [];
  let url = source.url;
  let page = 1;
  const limit = config.ingest.maxJobsPerSource;

  while (url && page <= MAX_PAGES && allItems.length < limit) {
    await rateLimiter.acquire(source.id, source.rpmLimit);
    await identityManager.humanDelay(400, 700);

    const headers = identityManager.buildHeaders(source.id, {
      Accept: 'application/json',
    });

    logger.debug({ sourceId: source.id, url, page }, 'Fetching JSON page');

    const { result, retries } = await withRetry(
      async () => {
        const response = await axios.get(url, {
          headers,
          timeout: 8000,
        });

        const body = response.data;

        if (!body || typeof body !== 'object') {
          const err = new Error('JSON response is not an object');
          err.code = 'PARSE_ERROR';
          throw err;
        }

        return body;
      },
      { sourceId: source.id, label: `json:${source.url}:page${page}` }
    );

    const items = source.schema?.itemsKey
      ? (result[source.schema.itemsKey] || [])
      : (result.data || result.jobs || result.results || []);
    allItems.push(...items);

    logger.debug(
      { sourceId: source.id, page, itemsOnPage: items.length, retries },
      'JSON page fetched'
    );

    const nextUrl = result.links?.next || result.next_page_url || null;
    url = nextUrl && items.length > 0 ? nextUrl : null;
    page++;
  }

  logger.info(
    { sourceId: source.id, totalItems: allItems.length, pages: page - 1 },
    'JSON feed fetched successfully'
  );

  return allItems;
}
