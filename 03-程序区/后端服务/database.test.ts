import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { openLibraryDatabase, withTransaction } from './database';
import { AssetRepository } from './repositories/AssetRepository';
import { RelationRepository } from './repositories/RelationRepository';
import { TagRepository } from './repositories/TagRepository';
import { TaskRepository } from './repositories/TaskRepository';

const withDatabase = (run: (database: DatabaseSync) => void) => {
  const database = openLibraryDatabase(':memory:');
  try {
    run(database);
  } finally {
    database.close();
  }
};

test('applies migrations once and safely reopens an existing library database', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'design-work-database-'));
  const databasePath = path.join(directory, 'library.sqlite');
  try {
    const first = openLibraryDatabase(databasePath);
    first.close();
    const second = openLibraryDatabase(databasePath);
    const migrations = second.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
    assert.deepEqual(migrations.map((row) => Number(row.version)), [1, 2, 3, 4]);
    second.close();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rolls back failed transactions without retaining partial writes', () => {
  withDatabase((database) => {
    assert.throws(() => withTransaction(database, () => {
      database.prepare(`
        INSERT INTO folders(id, name, created_at, updated_at) VALUES ('folder-1', '灵感', 1, 1)
      `).run();
      throw new Error('stop');
    }), /stop/);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM folders').get()?.count, 0);
  });
});

test('enforces foreign keys and rejects duplicate asset content hashes', () => {
  withDatabase((database) => {
    const assets = new AssetRepository(database);
    assert.throws(() => assets.create({
      type: 'image',
      title: '不存在的文件夹',
      primaryFolderId: 'missing-folder',
    }), /FOREIGN KEY/);

    assets.create({ type: 'image', title: '第一张', contentHash: 'same-content' });
    assert.throws(
      () => assets.create({ type: 'image', title: '重复图片', contentHash: 'same-content' }),
      /UNIQUE constraint failed: assets\.content_hash/,
    );
  });
});

test('keeps tag names case-insensitively unique and merges all associations', () => {
  withDatabase((database) => {
    const assets = new AssetRepository(database);
    const tags = new TagRepository(database);
    const firstAsset = assets.create({ type: 'image', title: '人物特写' });
    const secondAsset = assets.create({ type: 'video', title: '城市镜头' });
    const sourceTag = tags.create('Portrait');
    const targetTag = tags.create('精选');

    assert.throws(() => tags.create('portrait'), /UNIQUE constraint failed: tags\.name/);
    tags.attach(firstAsset.id, sourceTag);
    tags.attach(secondAsset.id, sourceTag);
    tags.attach(firstAsset.id, targetTag);
    tags.merge(sourceTag, targetTag);

    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM tags WHERE id = ?').get(sourceTag)?.count, 0);
    assert.deepEqual(
      database.prepare('SELECT asset_id FROM asset_tags WHERE tag_id = ? ORDER BY asset_id').all(targetTag)
        .map((row) => String(row.asset_id)),
      [secondAsset.id, firstAsset.id].sort((left, right) => left.localeCompare(right)),
    );
  });
});

test('supports outgoing and incoming asset relation lookup and rejects self references', () => {
  withDatabase((database) => {
    const assets = new AssetRepository(database);
    const relations = new RelationRepository(database);
    const project = assets.create({ type: 'video-project', title: '短片工程' });
    const shot = assets.create({ type: 'video', title: '分镜 01' });
    relations.create(project.id, shot.id, 'contains-shot', { scene: 1 });

    assert.equal(relations.outgoing(project.id, 'contains-shot').length, 1);
    assert.equal(relations.incoming(shot.id, 'contains-shot').length, 1);
    assert.throws(
      () => relations.create(project.id, project.id, 'contains-shot'),
      /CHECK constraint failed/,
    );
  });
});

test('searches title, description and extracted text through FTS', () => {
  withDatabase((database) => {
    const assets = new AssetRepository(database);
    const titleMatch = assets.create({ type: 'image', title: 'Neon city portrait' });
    const descriptionMatch = assets.create({
      type: 'video',
      title: 'Shot 02',
      description: 'cinematic dolly movement',
    });
    const extractedMatch = assets.create({
      type: 'prompt',
      title: 'Prompt note',
      extractedText: 'volumetric lighting reference',
    });

    assert.deepEqual(assets.search({ query: 'Neon' }).map((asset) => asset.id), [titleMatch.id]);
    assert.deepEqual(assets.search({ query: 'dolly' }).map((asset) => asset.id), [descriptionMatch.id]);
    assert.deepEqual(assets.search({ query: 'volumetric' }).map((asset) => asset.id), [extractedMatch.id]);
  });
});

test('uses AND semantics when filtering by multiple tags', () => {
  withDatabase((database) => {
    const assets = new AssetRepository(database);
    const tags = new TagRepository(database);
    const city = tags.create('城市');
    const night = tags.create('夜景');
    const both = assets.create({ type: 'image', title: '城市夜景' });
    const cityOnly = assets.create({ type: 'image', title: '白天城市' });
    tags.attach(both.id, city);
    tags.attach(both.id, night);
    tags.attach(cityOnly.id, city);

    assert.deepEqual(assets.search({ tagIds: [city, night] }).map((asset) => asset.id), [both.id]);
    assert.equal(assets.search({ tagIds: [city] }).length, 2);
  });
});

test('allows declared task states and rejects invalid status values', () => {
  withDatabase((database) => {
    const tasks = new TaskRepository(database);
    const id = tasks.create('generate-preview', { assetId: 'asset-1' }, 1);
    tasks.setStatus(id, 'running', { progress: 0.5, currentStep: '生成缩略图' }, 2);
    tasks.setStatus(id, 'completed', { progress: 1, output: { preview: 'ready' } }, 3);
    assert.equal(tasks.get(id)?.status, 'completed');
    assert.throws(
      () => database.prepare("UPDATE tasks SET status = 'unknown' WHERE id = ?").run(id),
      /CHECK constraint failed/,
    );
  });
});
