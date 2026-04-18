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

app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (_, res) => {
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

app.get('/admin', (_, res) => {
  res.sendFile(path.join(process.cwd(), 'public/admin.html'));
});

app.get('/admin/helper', adminAuth, (_, res) => {
  res.sendFile(path.join(process.cwd(), 'private/admin-helper.html'));
});

app.get('/admin/grand-tableau', adminAuth, (_, res) => {
  res.sendFile(path.join(process.cwd(), 'private/admin-grand-tableau.html'));
});

app.use((error, _, res, __) => {
  console.error(error);
  res.status(error.status || 500).json({
    ok: false,
    error: error.message || 'Internal server error',
  });
});

module.exports = app;
