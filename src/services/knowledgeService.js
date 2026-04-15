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

async function updateStoredEntry(entryId, patch) {
  const metadataList = await loadMetadata();
  const idx = metadataList.findIndex((item) => item.id === entryId);
  if (idx < 0) return null;
  metadataList[idx] = {
    ...metadataList[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveMetadata(metadataList);
  return metadataList[idx];
}

async function waitForVectorProcessing(vectorStoreFileId) {
  const timeoutAt = Date.now() + env.vectorProcessingTimeoutMs;

  while (Date.now() < timeoutAt) {
    const state = await openai.vectorStores.files.retrieve(
      env.vectorStoreId,
      vectorStoreFileId,
    );

    if (state.status === 'completed') {
      return { status: 'processed', vectorStoreFileStatus: state.status };
    }

    if (state.status === 'failed' || state.status === 'cancelled') {
      return {
        status: 'error',
        vectorStoreFileStatus: state.status,
        error: state.last_error?.message || `Vector file status: ${state.status}`,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, env.vectorProcessingPollMs));
  }

  return {
    status: 'processing',
    vectorStoreFileStatus: 'in_progress',
    error: 'Vector processing timeout exceeded; still processing.',
  };
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
    vectorStoreFileId: null,
    vectorStoreFileStatus: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  metadataList.push(entry);
  await saveMetadata(metadataList);

  if (!openai) return entry;

  try {
    const uploaded = await openai.files.create({
      file: await fs.open(file.path, 'r').then((handle) => handle.createReadStream()),
      purpose: 'assistants',
    });

    await updateStoredEntry(entry.id, {
      openaiFileId: uploaded.id,
      status: env.vectorStoreId ? 'processing' : 'uploaded',
    });

    if (!env.vectorStoreId) {
      return (await loadMetadata()).find((item) => item.id === entry.id);
    }

    const vsFile = await openai.vectorStores.files.create(env.vectorStoreId, {
      file_id: uploaded.id,
    });

    await updateStoredEntry(entry.id, {
      vectorStoreFileId: vsFile.id,
      vectorStoreFileStatus: vsFile.status || 'in_progress',
    });

    const processingResult = await waitForVectorProcessing(vsFile.id);

    const updated = await updateStoredEntry(entry.id, processingResult);
    return updated;
  } catch (error) {
    const failed = await updateStoredEntry(entry.id, {
      status: 'error',
      error: error.message,
    });
    return failed;
  }
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
    deck: patch.deck ?? list[idx].deck,
    topic: patch.topic ?? list[idx].topic,
    priority: patch.priority ?? list[idx].priority,
    type: patch.type ?? list[idx].type,
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
      // keep local delete successful
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
  if (type === 'tone' || type === 'rule') return 5;
  if (type === 'guidebook' || type === 'interpretation') return 3;
  return 1;
}

async function retrieveKnowledge({ question, deck, topic, intent }) {
  const items = await loadMetadata();

  const scored = items
    .map((item) => {
      let score = scorePriority(item.priority) + scoreType(item.type);
      if (item.type === 'tone' || item.type === 'rule') score += 8;
      if (deck && item.deck === deck) score += 6;
      if (topic && item.topic === topic) score += 5;
      if (intent && item.topic === intent) score += 4;
      if (!item.deck && !item.topic) score += 1;
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const query = [question, deck, topic, intent]
    .filter(Boolean)
    .join(' | ')
    .trim();

  if (!openai || !env.vectorStoreId || !query) {
    return scored.slice(0, 8).map((item) => ({
      source: item.originalName,
      excerpt: `${item.type}/${item.priority} 자료`,
      deck: item.deck,
      topic: item.topic,
    }));
  }

  try {
    const searchResult = await openai.vectorStores.search(env.vectorStoreId, {
      query,
      max_num_results: 8,
    });

    const vectorChunks = (searchResult.data || []).map((chunk) => ({
      source: chunk.filename || 'vector_store',
      excerpt: chunk.content?.[0]?.text || '',
      score: chunk.score || 0,
    }));

    if (vectorChunks.length > 0) return vectorChunks;
  } catch (_) {
    // fallback below
  }

  return scored.slice(0, 8).map((item) => ({
    source: item.originalName,
    excerpt: `${item.type}/${item.priority} 자료`,
    deck: item.deck,
    topic: item.topic,
  }));
}

module.exports = {
  indexUpload,
  listFiles,
  updateFileMetadata,
  deleteFile,
  retrieveKnowledge,
};
