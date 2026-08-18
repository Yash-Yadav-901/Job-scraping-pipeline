import { fetchRSS } from './rssAdapter.js';
import { fetchJSON } from './jsonAdapter.js';

// Route a source to its appropriate adapter based on source.type.

export async function fetchForSource(source) {
    switch (source.type) {
        case 'rss':
            return fetchRSS(source);
        case 'json':
            return fetchJSON(source);
        default:
            throw new Error(`Unknown source type: ${source.type} for source ${source.id}`);
    }
}
