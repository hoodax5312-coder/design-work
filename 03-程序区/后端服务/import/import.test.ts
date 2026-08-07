import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DirectoryScanner, ScanLimitExceededError } from './DirectoryScanner';
import { FilePickerCancelledError } from './FilePickerProvider';
import { FingerprintService } from './FingerprintService';
import { MacOsFilePickerProvider } from './MacOsFilePickerProvider';

const withTemporaryDirectory = async (run: (directory: string) => Promise<void>) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-import-'));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
};

test('macOS picker parses absolute paths and reports user cancellation', async () => {
  const files = new MacOsFilePickerProvider(async (arguments_) => {
    assert.equal(arguments_[0], '-e');
    return '/Users/test/a.png\n/Volumes/Archive/b.mp4\n';
  });
  assert.deepEqual(await files.pickFiles(), ['/Users/test/a.png', '/Volumes/Archive/b.mp4']);

  const cancelled = new MacOsFilePickerProvider(async () => {
    throw new Error('execution error: User canceled. (-128)');
  });
  await assert.rejects(cancelled.pickDirectory(), FilePickerCancelledError);
});

test('scans single files, nested directories and empty directories', async () => {
  await withTemporaryDirectory(async (directory) => {
    const nested = path.join(directory, 'nested');
    const empty = path.join(directory, 'empty');
    await fs.mkdir(nested);
    await fs.mkdir(empty);
    await fs.writeFile(path.join(directory, 'cover.png'), 'image');
    await fs.writeFile(path.join(nested, 'clip.mp4'), 'video');

    const result = await new DirectoryScanner().scan([directory]);
    assert.deepEqual(result.files.map((file) => file.fileName).sort(), ['clip.mp4', 'cover.png']);
    assert.equal(result.directoriesScanned, 3);
    assert.ok(result.files.every((file) => file.absolutePath.startsWith(directory)));
    assert.ok(result.files.every((file) => file.volumeId.startsWith('dev:')));
  });
});

test('does not follow symbolic links outside the selected directory', async () => {
  await withTemporaryDirectory(async (directory) => {
    const selected = path.join(directory, 'selected');
    const external = path.join(directory, 'external');
    await fs.mkdir(selected);
    await fs.mkdir(external);
    await fs.writeFile(path.join(external, 'secret.png'), 'secret');
    await fs.symlink(external, path.join(selected, 'escape'));

    const result = await new DirectoryScanner().scan([selected]);
    assert.equal(result.files.length, 0);
    assert.equal(result.issues[0]?.code, 'SYMLINK_SKIPPED');
  });
});

test('reports missing or offline paths without failing the whole scan', async () => {
  await withTemporaryDirectory(async (directory) => {
    const result = await new DirectoryScanner().scan([path.join(directory, 'offline-volume')]);
    assert.equal(result.files.length, 0);
    assert.equal(result.issues[0]?.code, 'ENOENT');
  });
});

test('supports cancellation and a strict file count limit', async () => {
  await withTemporaryDirectory(async (directory) => {
    await Promise.all(
      [0, 1, 2].map((index) => fs.writeFile(path.join(directory, `${index}.png`), 'x')),
    );
    await assert.rejects(
      new DirectoryScanner().scan([directory], { maxFiles: 2 }),
      ScanLimitExceededError,
    );

    const controller = new AbortController();
    await assert.rejects(
      new DirectoryScanner().scan([directory], {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
      (error: Error) => error.name === 'AbortError',
    );
  });
});

test('calculates stable quick and full fingerprints with streaming reads', async () => {
  await withTemporaryDirectory(async (directory) => {
    const first = path.join(directory, 'first.bin');
    const second = path.join(directory, 'second.bin');
    const content = Buffer.alloc(256 * 1024, 7);
    await fs.writeFile(first, content);
    await fs.copyFile(first, second);
    const firstStat = await fs.stat(first);
    await fs.utimes(second, firstStat.atime, firstStat.mtime);
    const fingerprints = new FingerprintService(1024);

    const [firstQuick, secondQuick, firstFull, secondFull] = await Promise.all([
      fingerprints.quick(first),
      fingerprints.quick(second),
      fingerprints.full(first),
      fingerprints.full(second),
    ]);
    assert.equal(firstQuick.key, secondQuick.key);
    assert.equal(firstFull, secondFull);
    assert.equal(firstFull.length, 64);
  });
});

test('cancels a streaming fingerprint operation', async () => {
  await withTemporaryDirectory(async (directory) => {
    const file = path.join(directory, 'large.bin');
    await fs.writeFile(file, Buffer.alloc(1024 * 1024, 1));
    const controller = new AbortController();
    await assert.rejects(
      new FingerprintService().full(file, {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
      (error: Error) => error.name === 'AbortError',
    );
  });
});
