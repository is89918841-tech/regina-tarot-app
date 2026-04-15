const path = require('path');

const UPLOAD_ROOT = process.env.UPLOAD_PATH || '/data/uploads';

module.exports = {
  port: Number(process.env.PORT || 3000),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  adminToken: process.env.ADMIN_TOKEN || '',
  uploadRoot: path.resolve(UPLOAD_ROOT),
  metadataStorePath:
    process.env.METADATA_STORE_PATH || path.join(UPLOAD_ROOT, 'metadata.json'),
  vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID || '',
  model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
};
