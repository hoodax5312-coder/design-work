import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { atomicWriteFile } from './atomicFile';
import {
  createLibraryPaths,
  ensureLibraryDirectories,
  resolveExistingWithinLibrary,
  resolveWithinLibrary,
} from './libraryPaths';
import { readStorageSettings, writeStorageSettings } from './storageSettings';

const withTemporaryDirectory = async (run: (directory: string) => Promise<void>) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mboard-library-'));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
};

test('creates the complete library directory layout', async () => {
  await withTemporaryDirectory(async (directory) => {
    const paths = createLibraryPaths(path.join(directory, 'library'));
    await ensureLibraryDirectories(paths);

    for (const child of [
      paths.root,
      paths.thumbnails,
      paths.videoProxies,
      paths.pptPreviews,
      paths.extractedText,
      paths.derivedAssets,
      paths.managedAssets,
      paths.taskTemp,
      paths.backups,
    ]) {
      assert.equal((await fs.stat(child)).isDirectory(), true);
    }
    assert.equal(paths.database, path.join(paths.root, 'library.sqlite'));
  });
});

test('rejects lexical and symbolic-link escapes from the library root', async () => {
  await withTemporaryDirectory(async (directory) => {
    const root = path.join(directory, 'library');
    const external = path.join(directory, 'external');
    await fs.mkdir(root);
    await fs.mkdir(external);
    await fs.writeFile(path.join(external, 'secret.txt'), 'outside');
    await fs.symlink(external, path.join(root, 'escape'));

    assert.throws(() => resolveWithinLibrary(root, '../external/secret.txt'), /超出资产库目录/);
    assert.throws(() => resolveWithinLibrary(root, path.join(external, 'secret.txt')), /相对路径/);
    await assert.rejects(
      resolveExistingWithinLibrary(root, 'escape/secret.txt'),
      /符号链接超出资产库目录/,
    );
  });
});

test('atomically replaces files and removes temporary output after failure', async () => {
  await withTemporaryDirectory(async (directory) => {
    const target = path.join(directory, 'settings.json');
    await atomicWriteFile(target, 'first');
    await atomicWriteFile(target, 'second');
    assert.equal(await fs.readFile(target, 'utf8'), 'second');

    const invalidTarget = path.join(directory, 'existing-directory');
    await fs.mkdir(invalidTarget);
    await assert.rejects(atomicWriteFile(invalidTarget, 'cannot replace directory'));
    const temporaryFiles = (await fs.readdir(directory)).filter((name) => name.endsWith('.tmp'));
    assert.deepEqual(temporaryFiles, []);
    assert.equal((await fs.stat(invalidTarget)).isDirectory(), true);
  });
});

test('persists normalized storage settings and creates the selected directory', async () => {
  await withTemporaryDirectory(async (projectRoot) => {
    const dataDirectory = path.join(projectRoot, 'external-library');
    const cacheDirectory = path.join(projectRoot, 'external-cache');
    const written = await writeStorageSettings(projectRoot, {
      dataDirectory,
      cacheDirectory,
      autoSaveGeneratedAssets: false,
    });

    assert.deepEqual(await readStorageSettings(projectRoot), written);
    assert.equal(written.dataDirectory, path.resolve(dataDirectory));
    assert.equal(written.cacheDirectory, path.resolve(cacheDirectory));
    assert.equal((await fs.stat(dataDirectory)).isDirectory(), true);
    assert.equal((await fs.stat(cacheDirectory)).isDirectory(), true);
  });
});

test('separates durable library data from disposable cache paths', async () => {
  await withTemporaryDirectory(async (directory) => {
    const dataDirectory = path.join(directory, 'data');
    const cacheDirectory = path.join(directory, 'cache');
    const paths = createLibraryPaths(dataDirectory, cacheDirectory);

    assert.equal(paths.database, path.join(dataDirectory, 'library.sqlite'));
    assert.equal(paths.managedAssets, path.join(dataDirectory, 'managed-assets'));
    assert.equal(paths.backups, path.join(dataDirectory, 'backups'));
    assert.equal(paths.thumbnails, path.join(cacheDirectory, 'thumbnails'));
    assert.equal(paths.videoProxies, path.join(cacheDirectory, 'video-proxies'));
    assert.equal(paths.pptPreviews, path.join(cacheDirectory, 'ppt-previews'));
    assert.equal(paths.taskTemp, path.join(cacheDirectory, 'task-temp'));
  });
});
