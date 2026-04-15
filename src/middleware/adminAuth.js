const env = require('../config/env');

function adminAuth(req, res, next) {
  if (!env.adminToken) {
    return res.status(500).json({
      ok: false,
      error: 'ADMIN_TOKEN is not configured on the server.',
    });
  }

  const headerToken = req.get('x-admin-token');
  if (!headerToken || headerToken !== env.adminToken) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized admin request.',
    });
  }

  return next();
}

module.exports = adminAuth;
