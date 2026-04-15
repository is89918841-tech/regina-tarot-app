const crypto = require('crypto');
const env = require('../config/env');

const SESSION_COOKIE_NAME = 'regina_admin_session';

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const pairs = cookieHeader.split(';').map((p) => p.trim()).filter(Boolean);
  const out = {};
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function createAdminSessionToken() {
  const ts = Date.now();
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${ts}.${nonce}`;
  const signature = sign(payload, env.adminSessionSecret);
  return `${payload}.${signature}`;
}

function verifyAdminSessionToken(token) {
  if (!token || !env.adminSessionSecret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const provided = parts[2];
  const expected = sign(payload, env.adminSessionSecret);

  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

module.exports = {
  SESSION_COOKIE_NAME,
  parseCookies,
  createAdminSessionToken,
  verifyAdminSessionToken,
};
