const env = require('../config/env');
const {
  SESSION_COOKIE_NAME,
  parseCookies,
  verifyAdminSessionToken,
} = require('../utils/adminSession');

function isRequestAuthorized(req) {
  const headerToken = req.get('x-admin-token');
  const cookies = parseCookies(req);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  const headerAuthed = headerToken && headerToken === env.adminToken;
  const cookieAuthed = verifyAdminSessionToken(sessionToken);

  return Boolean(headerAuthed || cookieAuthed);
}

function resolveOptions(optionOrReq) {
  if (!optionOrReq || typeof optionOrReq !== 'object') {
    return { mode: 'json' };
  }

  if (typeof optionOrReq.get === 'function' && optionOrReq.headers) {
    return null;
  }

  return { mode: optionOrReq.mode === 'redirect' ? 'redirect' : 'json' };
}

function handleUnauthorized(res, mode) {
  if (mode === 'redirect') {
    return res.redirect('/admin?auth=required');
  }

  return res.status(401).json({
    ok: false,
    error: 'Unauthorized admin request.',
  });
}

function guard(req, res, next, mode = 'json') {
  if (!env.adminToken) {
    if (mode === 'redirect') {
      return res.status(500).send('ADMIN_TOKEN is not configured on the server.');
    }

    return res.status(500).json({
      ok: false,
      error: 'ADMIN_TOKEN is not configured on the server.',
    });
  }

  if (!isRequestAuthorized(req)) {
    return handleUnauthorized(res, mode);
  }

  return next();
}

function adminAuth(optionOrReq, res, next) {
  const options = resolveOptions(optionOrReq);

  if (options) {
    return (req, response, nextFn) => guard(req, response, nextFn, options.mode);
  }

  return guard(optionOrReq, res, next, 'json');
}

module.exports = adminAuth;
