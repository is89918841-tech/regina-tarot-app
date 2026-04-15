const path = require('path');

const UPLOAD_ROOT = process.env.UPLOAD_PATH || '/data/uploads';

module.exports = {
  port: Number(process.env.PORT || 3000),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  adminToken: process.env.ADMIN_TOKEN || '',
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_TOKEN || '',
  adminSessionMaxAgeSec: Number(process.env.ADMIN_SESSION_MAX_AGE_SEC || 60 * 60 * 12),
  secureCookie: process.env.SECURE_COOKIE === 'true',
  uploadRoot: path.resolve(UPLOAD_ROOT),
  metadataStorePath:
    process.env.METADATA_STORE_PATH || path.join(UPLOAD_ROOT, 'metadata.json'),
  vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID || '',
  model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 100),
  vectorProcessingTimeoutMs: Number(process.env.VECTOR_PROCESSING_TIMEOUT_MS || 180000),
  vectorProcessingPollMs: Number(process.env.VECTOR_PROCESSING_POLL_MS || 3000),
};
