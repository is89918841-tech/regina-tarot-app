const path = require('path');
const crypto = require('crypto');

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.txt', '.docx']);

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasMojibakeChars(value) {
  const text = String(value || '');
  if (text.includes('�')) return true;
  const hasHangul = /[가-힣]/.test(text);
  const hasLatinExtended = /[À-ÿ]/.test(text);
  return !hasHangul && hasLatinExtended;
}

function tryRecoverUtf8FromLatin1(rawName) {
  try {
    const decoded = Buffer.from(String(rawName || ''), 'latin1').toString('utf8');
    return normalizeWhitespace(decoded);
  } catch (_) {
    return '';
  }
}

function chooseBestOriginalName(rawName) {
  const raw = normalizeWhitespace(rawName);
  const recovered = tryRecoverUtf8FromLatin1(raw);

  if (!raw && recovered) return recovered;
  if (!recovered) return raw;

  const rawLooksBroken = hasMojibakeChars(raw);
  const recoveredLooksBroken = hasMojibakeChars(recovered);

  if (rawLooksBroken && !recoveredLooksBroken) return recovered;
  if (!rawLooksBroken) return raw;
  return recovered || raw;
}

function normalizeExtension(filename, fallbackExt = '.pdf') {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (SUPPORTED_EXTENSIONS.has(ext)) return ext;
  return fallbackExt;
}

function isSupportedUploadType({ mimetype, extension }) {
  const mimeOk = SUPPORTED_MIME_TYPES.has((mimetype || '').toLowerCase());
  const extOk = SUPPORTED_EXTENSIONS.has((extension || '').toLowerCase());
  return mimeOk || extOk;
}

function getExtensionByMime(mimetype) {
  const mime = (mimetype || '').toLowerCase();
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'text/plain') return '.txt';
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return '.docx';
  }
  return '';
}

function makeSafeStorageName({ extension }) {
  const ts = Date.now();
  const token = crypto.randomBytes(6).toString('hex');
  const ext = SUPPORTED_EXTENSIONS.has(extension) ? extension : '.pdf';
  return `${ts}_upload_${token}${ext}`;
}

function normalizeUploadedFilename(file) {
  const originalNameRaw = normalizeWhitespace(file?.originalname || '');
  const originalNameNormalized = chooseBestOriginalName(originalNameRaw);
  const inferredExtension = getExtensionByMime(file?.mimetype);
  const extension = normalizeExtension(originalNameNormalized || originalNameRaw, inferredExtension || '.pdf');

  const displayName = originalNameNormalized || `unknown_filename${extension}`;
  const storedName = makeSafeStorageName({ extension });

  return {
    originalNameRaw,
    originalNameNormalized,
    displayName,
    extension,
    storedName,
  };
}

module.exports = {
  SUPPORTED_MIME_TYPES,
  SUPPORTED_EXTENSIONS,
  normalizeUploadedFilename,
  isSupportedUploadType,
};
