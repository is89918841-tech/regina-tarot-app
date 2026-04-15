const path = require('path');

function parseContentDisposition(headerValue = '') {
  const parts = headerValue.split(';').map((part) => part.trim());
  const out = {};
  for (const part of parts) {
    const [key, rawValue] = part.split('=');
    if (!rawValue) continue;
    out[key.toLowerCase()] = rawValue.replace(/^"|"$/g, '');
  }
  return out;
}

function parseMultipartBuffer(buffer, boundary) {
  const boundaryText = `--${boundary}`;
  const raw = buffer.toString('latin1');
  const sections = raw.split(boundaryText);
  const fields = {};
  let file = null;

  for (const section of sections) {
    if (!section || section === '--\r\n' || section === '--') continue;
    const trimmed = section.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const headerEndIndex = trimmed.indexOf('\r\n\r\n');
    if (headerEndIndex < 0) continue;

    const headerText = trimmed.slice(0, headerEndIndex);
    const bodyText = trimmed.slice(headerEndIndex + 4).replace(/\r\n$/, '');
    const headers = headerText.split('\r\n');

    const dispositionHeader = headers.find((h) =>
      h.toLowerCase().startsWith('content-disposition:'),
    );
    if (!dispositionHeader) continue;

    const contentTypeHeader = headers.find((h) =>
      h.toLowerCase().startsWith('content-type:'),
    );

    const disposition = parseContentDisposition(
      dispositionHeader.slice('content-disposition:'.length).trim(),
    );
    const fieldName = disposition.name;
    if (!fieldName) continue;

    if (disposition.filename) {
      const safeName = path.basename(disposition.filename);
      file = {
        filename: safeName,
        mimetype: contentTypeHeader
          ? contentTypeHeader.slice('content-type:'.length).trim()
          : 'application/octet-stream',
        buffer: Buffer.from(bodyText, 'latin1'),
      };
    } else {
      fields[fieldName] = Buffer.from(bodyText, 'latin1').toString('utf8');
    }
  }

  return { fields, file };
}

function extractBoundary(contentType = '') {
  const match = contentType.match(/boundary=([^;]+)/i);
  if (!match) return null;
  return match[1].replace(/^"|"$/g, '');
}

module.exports = {
  extractBoundary,
  parseMultipartBuffer,
};
