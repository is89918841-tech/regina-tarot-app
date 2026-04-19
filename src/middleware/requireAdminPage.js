const env = require('../config/env');
const {
  SESSION_COOKIE_NAME,
  parseCookies,
  verifyAdminSessionToken,
} = require('../utils/adminSession');

function requireAdminPage(req, res, next) {
  if (!env.adminToken) {
    return res.status(500).send('ADMIN_TOKEN is not configured on the server.');
  }

  const headerToken = req.get('x-admin-token');
  const cookies = parseCookies(req);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  const headerAuthed = headerToken && headerToken === env.adminToken;
  const cookieAuthed = verifyAdminSessionToken(sessionToken);

  if (!headerAuthed && !cookieAuthed) {
    return res.redirect('/admin?auth=required');
  }

  return next();
}

module.exports = requireAdminPage;
