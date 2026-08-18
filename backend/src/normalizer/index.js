import { jobId } from '../utils/hash.js';

const TAG_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'golang', 'go', 'rust', 'ruby',
  'react', 'vue', 'angular', 'svelte', 'next.js', 'nextjs', 'node.js', 'nodejs',
  'graphql', 'rest', 'grpc', 'kafka', 'redis', 'postgres', 'postgresql', 'mongodb',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'k8s', 'terraform', 'devops',
  'machine learning', 'ml', 'ai', 'llm', 'data science', 'backend', 'frontend',
  'full-stack', 'fullstack', 'mobile', 'ios', 'android', 'react native',
  'product manager', 'designer', 'ux', 'ui', 'engineer', 'developer',
];

function extractTags(text = '', sourceTags = []) {
  const lower = text.toLowerCase();
  const found = TAG_KEYWORDS.filter((kw) => lower.includes(kw));
  const combined = [...new Set([...sourceTags, ...found])];
  return combined.slice(0, 10);
}

function stripHtml(html = '') {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

function toISOSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  try {
    if (typeof value === 'number' && value < 1e12) {
      return new Date(value * 1000).toISOString();
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function normalizeRSSItem(item, source) {
  const url = item.link || item.guid || '';
  if (!url) return null;

  const rawDescription = item.contentEncoded || item.content || item.summary || '';
  const plainDescription = stripHtml(rawDescription);

  const tagText = `${item.title || ''} ${plainDescription}`;
  const tags = extractTags(tagText, source.tags || []);

  const company =
    item.creator ||
    item['dc:creator'] ||
    item.author ||
    extractCompanyFromTitle(item.title || '') ||
    null;

  const location =
    item.location ||
    item['job:location'] ||
    (source.tags?.includes('remote') ? 'Remote' : null);

  return {
    _id: jobId(url),
    title: (item.title || 'Untitled').trim().slice(0, 300),
    company: company ? company.trim().slice(0, 200) : null,
    location: location ? location.trim().slice(0, 200) : null,
    url,
    description: plainDescription || null,
    tags: tags,
    source_id: source.id,
    remote: Boolean(source.tags?.includes('remote')),
    posted_at: toISOSafe(item.isoDate || item.pubDate),
  };
}

function normalizeJSONItem(item, source) {
  const s = source.schema || {};

  const url = item.slug
    ? `https://www.arbeitnow.com/jobs/${item.slug}`
    : (item[s.urlKey] || item.url || item.apply_url || item.link || '');
  if (!url) return null;

  const title = item[s.titleKey] || item.title || 'Untitled';
  const company = item[s.companyKey] || item.company_name || item.company || null;
  const location = item[s.locationKey] || item.location || null;
  const rawDescription = item[s.descriptionKey] || item.description || '';
  const dateField = item[s.dateKey] || item.created_at || item.published_at || null;
  const rawTags = item[s.tagsKey] || item.tags || [];

  const tagText = `${title} ${stripHtml(rawDescription)}`;
  const sourceTags = [
    ...(source.tags || []),
    ...(Array.isArray(rawTags) ? rawTags : [rawTags]),
    ...(item.job_types || []),
    ...(item.job_type ? [item.job_type] : []),
  ].map((t) => String(t).toLowerCase());

  const tags = extractTags(tagText, sourceTags);

  const isRemote = s.remoteValue === true
    || item.remote === true
    || item.remote === 1
    || String(location || '').toLowerCase().includes('remote');

  return {
    _id: jobId(url),
    title: title.trim().slice(0, 300),
    company: company ? String(company).trim().slice(0, 200) : null,
    location: location ? String(location).trim().slice(0, 200) : null,
    url,
    description: stripHtml(rawDescription).slice(0, 2000) || null,
    tags: tags,
    source_id: source.id,
    remote: Boolean(isRemote),
    posted_at: toISOSafe(dateField),
  };
}

function extractCompanyFromTitle(title) {
  const match = title.match(/\bat\s+([A-Z][a-zA-Z0-9\s&.,'-]{1,60}?)(?:\s*[-–(]|$)/);
  return match ? match[1].trim() : null;
}

function normalize(rawItems, source) {
  const normalizer = source.type === 'rss' ? normalizeRSSItem : normalizeJSONItem;

  return rawItems
    .map((item) => {
      try {
        return normalizer(item, source);
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
}

export { normalize };
