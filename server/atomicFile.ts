import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const atomicWriteFile = async (
  targetPath: string,
  data: string | Uint8Array,
) => {
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await fs.mkdir(directory, { recursive: true });

  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(temporaryPath, 'wx');
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
};
