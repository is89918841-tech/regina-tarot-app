const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureDir } = require('./utils/fileStore');
const env = require('./config/env');
const adminRoutes = require('./routes/adminRoutes');
const readingRoutes = require('./routes/readingRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const adminAuth = require('./middleware/adminAuth');

const app = express();
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PRIVATE_DIR = path.join(ROOT_DIR, 'private');

ensureDir(env.uploadRoot).catch((error) => {
  console.error('Failed to ensure upload directory:', error);
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/healthz', (_, res) => {
  res.status(200).json({ ok: true, status: 'healthy' });
});

app.use('/api/reading', readingRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(PUBLIC_DIR));

app.get('/', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/consultation.html', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'consultation.html'));
});

app.get('/', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/consultation.html', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'consultation.html'));
});

app.get('/admin', adminAuth, (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get(['/admin/helper', '/admin/helper.html'], adminAuth, (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-helper.html'));
});

app.get(['/admin/grand-tableau', '/admin/grand-tableau.html'], adminAuth, (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-grand-tableau.html'));
});

app.get(['/admin/grand-tableau', '/admin/grand-tableau.html'], adminAuth, (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-grand-tableau.html'));
});

app.use((error, _req, res, _next) => {
  res.status(error.status || 500).json({
    ok: false,
    error: error.message || 'Internal server error',
  });
});

module.exports = app;