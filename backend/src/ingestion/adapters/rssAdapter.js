import RSSParser from 'rss-parser';
import axios from 'axios';
import logger from '../../utils/logger.js';
import identityManager from '../identityManager.js';
import rateLimiter from '../rateLimiter.js';
import { withRetry } from '../retryEngine.js';

const MIN_EXPECTED_FIELDS = 3;

const parser = new RSSParser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
      ['category', 'category'],
      ['location', 'location'],
    ],
  },
  timeout: 10000,
  headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
});

export async function fetchRSS(source) {
  await rateLimiter.acquire(source.id, source.rpmLimit);
  await identityManager.humanDelay(600, 1000);

  const headers = identityManager.buildHeaders(source.id, {
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  });

  logger.debug({ sourceId: source.id, url: source.url }, 'Fetching RSS feed');

  const { result, retries } = await withRetry(
    async () => {
      const response = await axios.get(source.url, {
        headers,
        timeout: 8000,
        responseType: 'text',
        decompress: true,
      });

      if (!response.data || response.data.trim().length === 0) {
        const err = new Error('Empty response body');
        err.code = 'EMPTY_RESPONSE';
        throw err;
      }

      const feed = await parser.parseString(response.data);
      return feed;
    },
    { sourceId: source.id, label: `rss:${source.url}` }
  );

  const items = result.items || [];

  if (items.length > 0) {
    const firstItem = items[0];
    const fieldCount = Object.keys(firstItem).filter((k) => firstItem[k]).length;

    if (fieldCount < MIN_EXPECTED_FIELDS) {
      logger.warn(
        { sourceId: source.id, fieldCount, expected: MIN_EXPECTED_FIELDS },
        'SCHEMA_DRIFT: RSS item has fewer fields than expected — source may have changed structure'
      );
    }
  }

  logger.info(
    { sourceId: source.id, itemCount: items.length, retries },
    'RSS feed fetched successfully'
  );

  return items;
}
