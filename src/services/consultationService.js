const crypto = require('crypto');
const env = require('../config/env');
const { readJson, writeJson } = require('../utils/fileStore');

function generateId() {
  return `cst_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

async function listConsultations() {
  const records = await readJson(env.consultationStorePath, []);
  return Array.isArray(records) ? records : [];
}

async function createConsultation(payload) {
  const records = await listConsultations();
  const item = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    status: 'received',
    menuId: payload.menuId,
    menuTitle: payload.menuTitle,
    name: payload.name,
    contactChannel: payload.contactChannel,
    question: payload.question,
  };

  records.unshift(item);
  await writeJson(env.consultationStorePath, records);
  return item;
}

module.exports = {
  listConsultations,
  createConsultation,
};
