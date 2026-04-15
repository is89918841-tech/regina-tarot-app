const env = require('../config/env');
const {
  SESSION_COOKIE_NAME,
  parseCookies,
  verifyAdminSessionToken,
} = require('../utils/adminSession');

function adminAuth(req, res, next) {
  if (!env.adminToken) {
    return res.status(500).json({
      ok: false,
      error: 'ADMIN_TOKEN is not configured on the server.',
    });
  }

  const headerToken = req.get('x-admin-token');
  const cookies = parseCookies(req);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  const headerAuthed = headerToken && headerToken === env.adminToken;
  const cookieAuthed = verifyAdminSessionToken(sessionToken);

  if (!headerAuthed && !cookieAuthed) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized admin request.',
    });
  }

  return next();
}

module.exports = adminAuth;
