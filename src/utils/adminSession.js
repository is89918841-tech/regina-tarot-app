const crypto = require('crypto');
const env = require('../config/env');

const SESSION_COOKIE_NAME = 'regina_admin_session';
const revokedSessionSignatures = new Set();

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

function createAdminSessionToken(nowMs = Date.now()) {
  const ts = nowMs;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${ts}.${nonce}`;
  const signature = sign(payload, env.adminSessionSecret);
  return `${payload}.${signature}`;
}

function isExpiredTimestamp(timestampMs, nowMs = Date.now()) {
  const ageMs = nowMs - timestampMs;
  return ageMs > env.adminSessionMaxAgeSec * 1000;
}

function isRevokedSession(signature) {
  return revokedSessionSignatures.has(signature);
}

function revokeSessionToken(token) {
  if (!token) return;
  const parts = token.split('.');
  if (parts.length === 3) {
    revokedSessionSignatures.add(parts[2]);
  }
}

function verifyAdminSessionToken(token, nowMs = Date.now()) {
  if (!token || !env.adminSessionSecret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const timestamp = Number(parts[0]);
  if (!Number.isFinite(timestamp)) return false;
  if (isExpiredTimestamp(timestamp, nowMs)) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const provided = parts[2];
  const expected = sign(payload, env.adminSessionSecret);

  if (isRevokedSession(provided)) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

function buildSessionCookieHeader(sessionToken) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${env.adminSessionMaxAgeSec}`,
  ];
  if (env.secureCookie) parts.push('Secure');
  return parts.join('; ');
}

function buildClearSessionCookieHeader() {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (env.secureCookie) parts.push('Secure');
  return parts.join('; ');
}

module.exports = {
  SESSION_COOKIE_NAME,
  parseCookies,
  createAdminSessionToken,
  verifyAdminSessionToken,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
  revokeSessionToken,
};
