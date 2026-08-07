import fs from 'node:fs/promises';
import path from 'node:path';

export interface LibraryPaths {
  root: string;
  dataRoot: string;
  cacheRoot: string;
  database: string;
  thumbnails: string;
  videoProxies: string;
  pptPreviews: string;
  extractedText: string;
  derivedAssets: string;
  managedAssets: string;
  taskTemp: string;
  backups: string;
}

export const createLibraryPaths = (dataDirectory: string, cacheDirectory = dataDirectory): LibraryPaths => {
  const dataRoot = path.resolve(dataDirectory);
  const cacheRoot = path.resolve(cacheDirectory);
  return {
    root: cacheRoot,
    dataRoot,
    cacheRoot,
    database: path.join(dataRoot, 'library.sqlite'),
    thumbnails: path.join(cacheRoot, 'thumbnails'),
    videoProxies: path.join(cacheRoot, 'video-proxies'),
    pptPreviews: path.join(cacheRoot, 'ppt-previews'),
    extractedText: path.join(cacheRoot, 'extracted-text'),
    derivedAssets: path.join(cacheRoot, 'derived-assets'),
    managedAssets: path.join(dataRoot, 'managed-assets'),
    taskTemp: path.join(cacheRoot, 'task-temp'),
    backups: path.join(dataRoot, 'backups'),
  };
};

export const ensureLibraryDirectories = async (paths: LibraryPaths) => {
  await Promise.all([
    paths.dataRoot,
    paths.cacheRoot,
    paths.thumbnails,
    paths.videoProxies,
    paths.pptPreviews,
    paths.extractedText,
    paths.derivedAssets,
    paths.managedAssets,
    paths.taskTemp,
    paths.backups,
  ].map((directory) => fs.mkdir(directory, { recursive: true })));
};

const isContained = (root: string, candidate: string) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
};

export const resolveWithinLibrary = (root: string, relativePath: string) => {
  if (path.isAbsolute(relativePath)) throw new Error('路径必须是资产库内的相对路径');
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relativePath);
  if (!isContained(resolvedRoot, candidate)) throw new Error('路径超出资产库目录');
  return candidate;
};

export const resolveExistingWithinLibrary = async (root: string, relativePath: string) => {
  const candidate = resolveWithinLibrary(root, relativePath);
  const [realRoot, realCandidate] = await Promise.all([
    fs.realpath(path.resolve(root)),
    fs.realpath(candidate),
  ]);
  if (!isContained(realRoot, realCandidate)) throw new Error('路径通过符号链接超出资产库目录');
  return realCandidate;
};
