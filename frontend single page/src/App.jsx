import React, { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { Zap, Atom, MapPin, Globe, ClipboardList, Search, BarChart3, Mailbox, Check, X, FolderOpen } from 'lucide-react';

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function apiFetch(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}


function Navbar({ health }) {
  const isOk = health?.status === 'ok';
  return (
    <header>
      <div className="header-inner">
        <a href="/" className="logo">
          <div className="logo-icon"><FolderOpen size={24} /></div>
          JobStream
        </a>
        <div className="header-badges">
         
          <div className="live-badge">
            <span className="live-dot"></span>
            LIVE
          </div>
          <div className="live-badge" style={{
            color: isOk ? 'var(--green)' : 'var(--red)',
            background: isOk ? 'var(--green-soft)' : 'var(--red-soft)',
            borderColor: isOk ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'
          }}>
            {health ? (isOk ? <><Check size={12} style={{marginRight: "2px"}} /> DB ok · ↑{health.uptime}s</> : <><X size={12} style={{marginRight: "2px"}} /> Offline</>) : 'Checking…'}
          </div>
        </div>
      </div>
    </header>
  );
}

function StatsBar({ stats }) {
  const o = stats || {};
  const successRate = o.total_runs > 0 ? Math.round((o.successful_runs / o.total_runs) * 100) + '%' : '—';
  return (
    <React.Fragment>
      <p className="section-title">Pipeline Overview</p>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">{(o.total_jobs ?? 0).toLocaleString()}</div>
          <div className="stat-sub">across all sources</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Runs</div>
          <div className="stat-value">{(o.total_runs ?? 0).toLocaleString()}</div>
          <div className="stat-sub">ingestion cycles</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value">{successRate}</div>
          <div className="stat-sub">runs completed ok</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Sources</div>
          <div className="stat-value">{o.active_sources ?? 0}</div>
          <div className="stat-sub">ingestion feeds</div>
        </div>
      </div>
    </React.Fragment>
  );
}

function SourceCards({ sources }) {
  return (
    <React.Fragment>
      <p className="section-title">Source Health</p>
      <div className="sources-grid">
        {sources.map(s => (
          <div className="source-card" key={s.id || s._id}>
            <div className="source-header">
              <div>
                <div className="source-name">{s.name}</div>
                <div className="source-desc">{s.description || ''}</div>
              </div>
              <div className={`circuit-badge ${s.circuit_state}`}>
                <span className="circuit-dot"></span>
                {s.circuit_state}
              </div>
            </div>
            <div className="source-stats">
              <div className="source-stat">
                <div className="source-stat-label">Total Fetched</div>
                <div className="source-stat-value">{(s.total_jobs_fetched || 0).toLocaleString()}</div>
              </div>
              <div className="source-stat">
                <div className="source-stat-label">Last Run</div>
                <div className="source-stat-value">{s.jobs_last_run ?? 0}</div>
              </div>
            </div>
            <div className="last-run-tag">
              <span className={`run-status-dot ${s.last_run_status || 'error'}`}></span>
              {s.last_run_status ? s.last_run_status : 'Never run'} · {relativeTime(s.last_run_at)}
              {s.consecutive_failures > 0 && (
                <span style={{ color: 'var(--red)' }}> · {s.consecutive_failures} fail{s.consecutive_failures > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function JobItem({ job, index }) {
  const tags = Array.isArray(job.tags) ? job.tags : [];
  const visibleTags = tags.slice(0, 4);
  return (
    <div className="job-item" style={{ animationDelay: `${index * 25}ms` }}>
      <div>
        <div className="job-title">{job.title}</div>
        <div className="job-meta">
          {job.company && <span className="job-company">{job.company}</span>}
          {job.company && job.location && <span className="job-sep">·</span>}
          {job.location && <span className="job-location"><MapPin size={12} style={{marginRight: "2px"}} /> {job.location}</span>}
        </div>
        <div className="job-tags">
          {job.remote && <span className="tag remote"><Globe size={12} style={{marginRight: "2px"}} /> Remote</span>}
          {visibleTags.filter(t => t !== 'remote').map((t, idx) => (
            <span className="tag" key={idx}>{t}</span>
          ))}
          {tags.length > 5 && <span className="tag">+{tags.length - 4}</span>}
        </div>
      </div>
      <div className="job-actions">
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="job-apply-btn">
          Apply ↗
        </a>
        <span className="job-source-badge">{job.source_id}</span>
        <span className="job-time">{relativeTime(job.fetched_at)}</span>
      </div>
    </div>
  );
}

function JobsPanel({ jobs, pagination, isLoading, searchQuery, setSearchQuery, selectedSource, setSelectedSource, onRefresh, onPageChange }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ClipboardList size={16} /> Live Job Feed
          <span className="panel-count">{pagination.total?.toLocaleString() ?? '—'}</span>
        </div>
        <button className="btn btn-ghost" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? <span className="spinner"></span> : '↺ Refresh'}
        </button>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <span className="search-icon"><Search size={14} /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Search jobs, companies, tags…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <select
          className="filter-select"
          value={selectedSource}
          onChange={e => setSelectedSource(e.target.value)}
        >
          <option value="">All Sources</option>
          <option value="remotive">Remotive</option>
          <option value="arbeitnow">Arbeitnow</option>
          <option value="himalayas">Himalayas</option>
          <option value="hasjob">Hasjob (India)</option>
        </select>
      </div>

      <div className="job-list-container">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div className="skeleton-job" key={i}>
              <div className="skeleton sk-line sk-title"></div>
              <div className="skeleton sk-line sk-meta"></div>
              <div className="skeleton sk-tags"></div>
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Search size={32} /></div>
            <div className="empty-title">{searchQuery ? `No results for "${searchQuery}"` : 'No jobs yet'}</div>
            <div className="empty-sub">{searchQuery ? 'Try a different keyword or filter' : 'Trigger an ingest run to populate jobs'}</div>
          </div>
        ) : (
          jobs.map((job, idx) => (
            <JobItem job={job} index={idx} key={job._id || job.id || idx} />
          ))
        )}
      </div>

      <div className="pagination">
        <span className="pagination-info">
          {pagination.total > 0
            ? `${((pagination.page - 1) * pagination.limit) + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total.toLocaleString()}`
            : 'No results'}
        </span>
        <div className="pagination-controls">
          <button className="page-btn" disabled={!pagination.hasPrevPage} onClick={() => onPageChange(pagination.page - 1)}>‹</button>
          <button className="page-btn active">{pagination.page}</button>
          <button className="page-btn" disabled={!pagination.hasNextPage} onClick={() => onPageChange(pagination.page + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}

function ManualIngestCard({ ingestSource, setIngestSource, isIngesting, onTrigger, result }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><Zap size={16} /> Manual Ingest</div>
      </div>
      <div className="ingest-area">
        <div className="ingest-row">
          <select
            className="ingest-select"
            value={ingestSource}
            onChange={e => setIngestSource(e.target.value)}
          >
            <option value="">All Sources</option>
            <option value="remotive">Remotive</option>
            <option value="arbeitnow">Arbeitnow</option>
            <option value="himalayas">Himalayas</option>
            <option value="hasjob">Hasjob (India)</option>
          </select>
          <button className="btn btn-primary" onClick={onTrigger} disabled={isIngesting}>
            {isIngesting ? <span className="spinner"></span> : 'Run'}
          </button>
        </div>
        {result && (
          <div className={`ingest-result ${result.status}`}>
            {result.text}
          </div>
        )}
      </div>
    </div>
  );
}

function RunLogCard({ runs }) {
  const items = runs || [];
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <BarChart3 size={16} /> Run Log
          <span className="panel-count">{items.length}</span>
        </div>
      </div>
      <div className="run-log">
        {items.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-icon"><Mailbox size={32} /></div>
            <div className="empty-title">No runs yet</div>
            <div className="empty-sub">Trigger an ingest to see results</div>
          </div>
        ) : (
          items.map((r, i) => (
            <div className="run-item" key={r.id || i}>
              <div className="run-header">
                <span className="run-source">{r.source}</span>
                <span className={`run-status ${r.status}`}>{r.status}</span>
              </div>
              <div className="run-details">
                <span><span className="run-detail-num">{r.jobsFound ?? 0}</span> found</span>
                <span><span className="run-detail-num">{r.jobsNew ?? 0}</span> new</span>
                <span>{relativeTime(r.startedAt)}</span>
              </div>
              {r.errorMessage && (
                <div style={{ fontSize: '0.68rem', color: 'var(--red)', marginTop: '4px', wordBreak: 'break-word' }}>
                  {r.errorMessage.slice(0, 120)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div id="toast-container">
      {toasts.map(t => (
        <div className={`toast ${t.type}`} key={t.id}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [sources, setSources] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  const [ingestSource, setIngestSource] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState(null);

  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'ok') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const fetchHealth = async () => {
    try {
      const data = await apiFetch('/api/health');
      setHealth(data);
    } catch {
      setHealth({ status: 'error' });
    }
  };

  const fetchStatsAndSources = async () => {
    try {
      const [statsData, sourcesData] = await Promise.all([
        apiFetch('/api/stats'),
        apiFetch('/api/sources')
      ]);
      setStats(statsData);
      setSources(sourcesData.data || []);
    } catch (err) {
      console.error('Failed to load stats/sources:', err);
    }
  };

  const fetchJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const params = new URLSearchParams({ page: currentPage, limit: 15 });
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedSource) params.set('source', selectedSource);

      const data = await apiFetch(`/api/jobs?${params}`);
      setJobs(data.data || []);
      setPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [currentPage, searchQuery, selectedSource]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSource]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchHealth();
    fetchStatsAndSources();
    const timer = setInterval(() => {
      fetchHealth();
      fetchStatsAndSources();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleTriggerIngest = async () => {
    setIsIngesting(true);
    setIngestResult({ status: 'ok', text: 'Running ingestion…' });

    try {
      const body = ingestSource ? { source: ingestSource } : {};
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Ingest failed');

      const totalNew = (data.runs || []).reduce((s, r) => s + (r.jobsNew || 0), 0);
      const totalFound = (data.runs || []).reduce((s, r) => s + (r.jobsFound || 0), 0);

      setIngestResult({ status: 'ok', text: <><Check size={12} style={{marginRight: "2px"}} /> {totalFound} found, {totalNew} new jobs added</> });
      addToast(`Ingest complete: ${totalNew} new jobs`, 'ok');

      fetchJobs();
      fetchStatsAndSources();
    } catch (err) {
      setIngestResult({ status: 'error', text: <><X size={12} style={{marginRight: "2px"}} /> {err.message}</> });
      addToast(err.message, 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <React.Fragment>
      <Navbar health={health} />
      <main>
        <StatsBar stats={stats?.overall} />
        <SourceCards sources={sources} />
        <div className="content-grid">
          <JobsPanel
            jobs={jobs}
            pagination={pagination}
            isLoading={isLoadingJobs}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedSource={selectedSource}
            setSelectedSource={setSelectedSource}
            onRefresh={fetchJobs}
            onPageChange={setCurrentPage}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ManualIngestCard
              ingestSource={ingestSource}
              setIngestSource={setIngestSource}
              isIngesting={isIngesting}
              onTrigger={handleTriggerIngest}
              result={ingestResult}
            />
            <RunLogCard runs={stats?.recentRuns} />
          </div>
        </div>
      </main>
      <ToastContainer toasts={toasts} />
    </React.Fragment>
  );
}
