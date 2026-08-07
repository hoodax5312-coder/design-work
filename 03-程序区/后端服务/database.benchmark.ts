import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { openLibraryDatabase, withTransaction } from './database';
import { AssetRepository } from './repositories/AssetRepository';

const assetCount = 100_000;
const sampleCount = 30;
const maximumP95Milliseconds = 300;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'design-work-benchmark-'));
const databasePath = path.join(directory, 'library.sqlite');
const database = openLibraryDatabase(databasePath);

const percentile95 = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
};

const measure = (operation: () => unknown) => {
  const values: number[] = [];
  for (let index = 0; index < sampleCount + 3; index += 1) {
    const startedAt = performance.now();
    operation();
    const duration = performance.now() - startedAt;
    if (index >= 3) values.push(duration);
  }
  return percentile95(values);
};

try {
  const insertAsset = database.prepare(`
    INSERT INTO assets(
      id, type, title, description, content_hash, favorite, rating, status,
      raw_metadata, normalized_metadata, user_metadata, created_at, imported_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', '{}', '{}', '{}', ?, ?, ?)
  `);
  const insertFts = database.prepare(`
    INSERT INTO asset_fts(asset_id, title, description, extracted_text) VALUES (?, ?, ?, ?)
  `);
  const insertTag = database.prepare(`
    INSERT INTO tags(id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
  `);
  const attachTag = database.prepare(`
    INSERT INTO asset_tags(asset_id, tag_id, created_at) VALUES (?, ?, ?)
  `);

  const seededAt = performance.now();
  withTransaction(database, () => {
    insertTag.run('tag-city', '城市', 1, 1);
    insertTag.run('tag-night', '夜景', 1, 1);
    for (let index = 0; index < assetCount; index += 1) {
      const id = `asset-${index.toString().padStart(6, '0')}`;
      const type = index % 4 === 0 ? 'video' : index % 4 === 1 ? 'ppt' : 'image';
      const title = index % 20 === 0 ? `Neon city reference ${index}` : `Creative asset ${index}`;
      const description = index % 25 === 0 ? 'cinematic night street' : 'design library item';
      insertAsset.run(id, type, title, description, `hash-${index}`, index % 11 === 0 ? 1 : 0, index % 6, index, index, index);
      insertFts.run(id, title, description, index % 100 === 0 ? 'volumetric lighting' : '');
      if (index % 10 === 0) attachTag.run(id, 'tag-city', index);
      if (index % 20 === 0) attachTag.run(id, 'tag-night', index);
    }
  });
  database.exec('PRAGMA optimize');
  const seedSeconds = (performance.now() - seededAt) / 1000;

  const assets = new AssetRepository(database);
  const scenarios = {
    titleSearch: () => assets.search({ query: 'Neon', limit: 100 }),
    typeFilter: () => assets.search({ type: 'video', limit: 100 }),
    tagIntersection: () => assets.search({ tagIds: ['tag-city', 'tag-night'], limit: 100 }),
  };
  const results = Object.entries(scenarios).map(([name, operation]) => ({
    name,
    p95Milliseconds: measure(operation),
  }));

  console.log(JSON.stringify({
    assetCount,
    seedSeconds: Number(seedSeconds.toFixed(2)),
    pageSize: 100,
    sampleCount,
    maximumP95Milliseconds,
    results: results.map((result) => ({
      ...result,
      p95Milliseconds: Number(result.p95Milliseconds.toFixed(2)),
      passed: result.p95Milliseconds < maximumP95Milliseconds,
    })),
  }, null, 2));

  if (results.some((result) => result.p95Milliseconds >= maximumP95Milliseconds)) {
    process.exitCode = 1;
  }
} finally {
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
