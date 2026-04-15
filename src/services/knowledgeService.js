const path = require('path');
const fs = require('fs/promises');
const OpenAI = require('openai');
const env = require('../config/env');
const { ensureDir, readJson, writeJson } = require('../utils/fileStore');

const openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

async function loadMetadata() {
  return readJson(env.metadataStorePath, []);
}

async function saveMetadata(items) {
  await writeJson(env.metadataStorePath, items);
}

async function indexUpload({ file }) {
  await ensureDir(env.uploadRoot);
  const metadataList = await loadMetadata();

  const entry = {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    originalName: file.originalname,
    storedName: file.filename,
    localPath: file.path,
    mimeType: file.mimetype,
    size: file.size,
    deck: file.deck || '',
    topic: file.topic || '',
    priority: file.priority || 'optional',
    type: file.type || 'guidebook',
    status: 'saved',
    openaiFileId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (openai) {
    try {
      const uploaded = await openai.files.create({
        file: await fs.open(file.path, 'r').then((handle) => handle.createReadStream()),
        purpose: 'assistants',
      });
      entry.openaiFileId = uploaded.id;
      entry.status = 'uploaded';

      if (env.vectorStoreId) {
        await openai.vectorStores.files.create(env.vectorStoreId, {
          file_id: uploaded.id,
        });
        entry.status = 'processed';
      }
    } catch (error) {
      entry.status = 'error';
      entry.error = error.message;
    }
  }

  metadataList.push(entry);
  await saveMetadata(metadataList);
  return entry;
}

async function listFiles() {
  return loadMetadata();
}

async function updateFileMetadata(id, patch) {
  const list = await loadMetadata();
  const idx = list.findIndex((item) => item.id === id);
  if (idx < 0) return null;

  list[idx] = {
    ...list[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveMetadata(list);
  return list[idx];
}

async function deleteFile(id) {
  const list = await loadMetadata();
  const target = list.find((item) => item.id === id);
  if (!target) return null;

  const next = list.filter((item) => item.id !== id);
  await saveMetadata(next);

  try {
    await fs.unlink(path.resolve(target.localPath));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (openai && target.openaiFileId) {
    try {
      await openai.files.del(target.openaiFileId);
    } catch (_) {
      // Keep local delete successful even if remote delete fails.
    }
  }

  return target;
}

function scorePriority(priority) {
  if (priority === 'core') return 4;
  if (priority === 'support') return 2;
  return 1;
}

function scoreType(type) {
  if (type === 'tone' || type === 'rule') return 4;
  if (type === 'guidebook' || type === 'interpretation') return 2;
  return 1;
}

async function retrieveKnowledge({ deck, topic }) {
  const items = await loadMetadata();
  const scored = items
    .map((item) => {
      let score = scorePriority(item.priority) + scoreType(item.type);
      if (item.type === 'tone' || item.type === 'rule') score += 8;
      if (deck && item.deck === deck) score += 5;
      if (topic && item.topic === topic) score += 4;
      if (!item.deck && !item.topic) score += 1;
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (!openai || !env.vectorStoreId) {
    return scored.map((item) => ({
      source: item.originalName,
      excerpt: `${item.type}/${item.priority} 자료로 등록됨`,
    }));
  }

  // If vector search is configured, use top metadata IDs as hints and still limit chunk count.
  const query = [deck, topic].filter(Boolean).join(' ') || '타로 리딩 기본 규칙';
  const searchResult = await openai.vectorStores.search(env.vectorStoreId, {
    query,
    max_num_results: 8,
  });

  return (searchResult.data || []).map((chunk) => ({
    source: chunk.filename || 'vector_store',
    excerpt: chunk.content?.[0]?.text || '',
  }));
}

module.exports = {
  indexUpload,
  listFiles,
  updateFileMetadata,
  deleteFile,
  retrieveKnowledge,
};
