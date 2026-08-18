import mongoose from 'mongoose';


const jobSchema = new mongoose.Schema({
  _id:         { type: String },          // sha256(url) — dedup key
  title:       { type: String, required: true },
  company:     { type: String, default: null },
  location:    { type: String, default: null },
  url:         { type: String, required: true },
  description: { type: String, default: null },
  tags:        { type: [String], default: [] },
  source_id:   { type: String, required: true, index: true },
  remote:      { type: Boolean, default: false },
  posted_at:   { type: Date, default: null },
  fetched_at:  { type: Date, default: Date.now },
}, { _id: false, versionKey: false });

jobSchema.index({ fetched_at: -1 });
jobSchema.index({ title: 'text', company: 'text', tags: 'text' });

export const Job = mongoose.model('Job', jobSchema);

//Source Schema
const sourceSchema = new mongoose.Schema({
  _id:                  { type: String },   // source id 
  name:                 { type: String, required: true },
  url:                  { type: String, required: true },
  type:                 { type: String, required: true },
  enabled:              { type: Boolean, default: true },
  circuit_state:        { type: String, default: 'CLOSED' },
  last_run_at:          { type: Date, default: null },
  last_run_status:      { type: String, default: null },
  jobs_last_run:        { type: Number, default: 0 },
  total_jobs_fetched:   { type: Number, default: 0 },
  consecutive_failures: { type: Number, default: 0 },
  description:          { type: String, default: '' },
}, { _id: false, versionKey: false });

export const Source = mongoose.model('Source', sourceSchema);

//IngestRun Schema
const runSchema = new mongoose.Schema({
  _id:           { type: String },          // runId()
  source_id:     { type: String, required: true, index: true },
  started_at:    { type: Date, default: Date.now },
  finished_at:   { type: Date, default: null },
  status:        { type: String, default: 'running' },
  jobs_found:    { type: Number, default: 0 },
  jobs_new:      { type: Number, default: 0 },
  error_message: { type: String, default: null },
  retries:       { type: Number, default: 0 },
}, { _id: false, versionKey: false });

runSchema.index({ started_at: -1 });

export const IngestRun = mongoose.model('IngestRun', runSchema);
