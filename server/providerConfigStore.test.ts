import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createProviderConfigStore, maskKey } from './providerConfigStore';
import type { ProviderConfig } from '../src/types/provider';

const KEY = 'sk-test-provider-key-1234';
const MODEL_KEY = 'sk-test-model-key-abcd5678';

const makeProvider = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  id: 'p1',
  name: 'Test',
  protocol: 'chat-completions',
  baseUrl: 'https://api.example.com/v1',
  apiKey: KEY,
  models: [{ id: 'text', categories: ['language'] }],
  selectedModels: { language: 'text' },
  ...overrides,
});

/** 每个测试一个临时目录，不碰用户真实的 providers.json。 */
const withStore = async (
  run: (store: ReturnType<typeof createProviderConfigStore>, filePath: string) => Promise<void>,
) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lizuo-provider-config-'));
  const filePath = path.join(root, 'LIZUO', 'providers.json');
  try {
    await run(createProviderConfigStore(filePath), filePath);
  } finally {
    await fs.chmod(filePath, 0o600).catch(() => undefined);
    await fs.rm(root, { recursive: true, force: true });
  }
};

test('reads an empty config without creating the file', async () => {
  await withStore(async (store, filePath) => {
    assert.deepEqual(await store.read(), { providers: [], activeProviderIds: {} });
    await assert.rejects(fs.stat(filePath), { code: 'ENOENT' });
  });
});

test('saves with private permissions and never returns the key', async () => {
  await withStore(async (store, filePath) => {
    const saved = await store.saveProvider('p1', makeProvider());
    assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(path.dirname(filePath))).mode & 0o777, 0o700);

    for (const snapshot of [saved, await store.read()]) {
      assert.equal(JSON.stringify(snapshot).includes(KEY), false);
      assert.equal(snapshot.providers[0].apiKey, '');
      assert.deepEqual(snapshot.providers[0].apiKeyHint, { masked: 'sk-…1234', origins: ['https://api.example.com'] });
    }

    const file = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.equal(file.format, 'lizuo-provider-config');
    assert.equal(file.version, 1);
    assert.equal(file.providers[0].apiKey, KEY);
    assert.equal((await store.exportState()).providers[0].apiKey, KEY);
  });
});

test('masks short keys without showing any character', () => {
  assert.equal(maskKey('short-key'), '••••••');
  assert.equal(maskKey(`  ${KEY}  `), 'sk-…1234');
});

test('keeps the saved key when the form leaves it empty on the same host', async () => {
  await withStore(async (store) => {
    await store.saveProvider('p1', makeProvider());
    // 设置页拿到的是掩码后的配置，原样保存回去时 Key 为空。
    const [publicProvider] = (await store.read()).providers;
    await store.saveProvider('p1', { ...publicProvider, name: 'Renamed', baseUrl: 'https://api.example.com/v2' });
    const [stored] = (await store.exportState()).providers;
    assert.equal(stored.name, 'Renamed');
    assert.equal(stored.apiKey, KEY);
  });
});

test('refuses to send the saved key to a different host', async () => {
  await withStore(async (store) => {
    await store.saveProvider('p1', makeProvider());
    const [publicProvider] = (await store.read()).providers;

    await assert.rejects(
      store.saveProvider('p1', { ...publicProvider, baseUrl: 'https://other.example/v1' }),
      /Base URL 的域名（host）与保存时不同.*请重新填写通用 API Key/,
    );
    // 没有自己 Key 的模型改到别的域名，同样会把通用 Key 带过去。
    await assert.rejects(
      store.saveProvider('p1', {
        ...publicProvider,
        models: [{ id: 'text', categories: ['language'], baseUrlOverride: 'https://other.example/v1' }],
      }),
      /域名（host）与保存时不同/,
    );
    const [stored] = (await store.exportState()).providers;
    assert.equal(stored.baseUrl, 'https://api.example.com/v1');
    assert.equal(stored.apiKey, KEY);

    await store.saveProvider('p1', { ...publicProvider, baseUrl: 'https://other.example/v1', apiKey: 'sk-new-provider-key-0000' });
    assert.equal((await store.exportState()).providers[0].apiKey, 'sk-new-provider-key-0000');
  });
});

test('keeps a saved model key only when one was saved for that model', async () => {
  await withStore(async (store) => {
    await store.saveProvider('p1', makeProvider({
      models: [
        { id: 'text', categories: ['language'] },
        { id: 'image', categories: ['image'], baseUrlOverride: 'https://image.example/v1', apiKeyOverride: MODEL_KEY },
      ],
    }));
    const [publicProvider] = (await store.read()).providers;
    const image = publicProvider.models.find((model) => model.id === 'image');
    assert.equal(JSON.stringify(publicProvider).includes(MODEL_KEY), false);
    assert.equal(image?.apiKeyOverride, undefined);
    assert.deepEqual(image?.apiKeyOverrideHint, { masked: 'sk-…5678', origins: ['https://image.example'] });

    await store.saveProvider('p1', publicProvider);
    const [stored] = (await store.exportState()).providers;
    assert.equal(stored.apiKey, KEY);
    assert.equal(stored.models.find((model) => model.id === 'image')?.apiKeyOverride, MODEL_KEY);

    await assert.rejects(
      store.saveProvider('p1', {
        ...publicProvider,
        models: [...publicProvider.models, { id: 'video', categories: ['video'], apiKeyOverrideHint: { masked: 'sk-…0000', origins: [] } }],
      }),
      /模型 video 没有已保存的 API Key/,
    );
    await assert.rejects(
      store.saveProvider('p1', {
        ...publicProvider,
        models: publicProvider.models.map((model) => (model.id === 'image'
          ? { ...model, baseUrlOverride: 'https://other.example/v1' }
          : model)),
      }),
      /模型 image 的 Base URL 域名（host）与保存时不同/,
    );
  });
});

test('rejects a save whose provider ID does not match the request', async () => {
  await withStore(async (store) => {
    await assert.rejects(store.saveProvider('p2', makeProvider()), /厂商 ID 与请求地址不一致/);
  });
});

test('serializes concurrent saves so neither is lost', async () => {
  await withStore(async (store) => {
    await Promise.all([
      store.saveProvider('p1', makeProvider()),
      store.saveProvider('p2', makeProvider({ id: 'p2', name: 'Second' })),
    ]);
    assert.deepEqual((await store.read()).providers.map((provider) => provider.id).sort(), ['p1', 'p2']);
  });
});

test('leaves a corrupt file untouched', async () => {
  await withStore(async (store, filePath) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const corrupt = '{"format": "lizuo-provider-config", "providers": [';
    await fs.writeFile(filePath, corrupt);

    await assert.rejects(store.read(), /API 配置文件已损坏（不是有效的 JSON），为避免覆盖，栗作没有改动它/);
    await assert.rejects(store.saveProvider('p1', makeProvider()), /已损坏/);
    await assert.rejects(store.importProviders({ providers: [makeProvider()] }, 'add-missing'), /已损坏/);
    assert.equal(await fs.readFile(filePath, 'utf8'), corrupt);
  });
});

test('rejects files with an unknown format or a newer version', async () => {
  await withStore(async (store, filePath) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ format: 'something-else', version: 1, providers: [] }));
    await assert.rejects(store.read(), /API 配置文件格式不正确/);

    await fs.writeFile(filePath, JSON.stringify({ format: 'lizuo-provider-config', version: 2, providers: [] }));
    await assert.rejects(store.read(), /API 配置文件版本比当前栗作新/);
  });
});

test('explains a permission error instead of treating the file as empty', {
  skip: process.getuid?.() === 0 ? 'root 可以读取任何文件' : false,
}, async () => {
  await withStore(async (store, filePath) => {
    await store.saveProvider('p1', makeProvider());
    await fs.chmod(filePath, 0o000);
    await assert.rejects(store.read(), (error: Error & { status?: number }) => {
      assert.match(error.message, /^没有权限读取 API 配置：.*providers\.json。请检查这个文件和所在文件夹的读写权限。$/);
      assert.equal(error.status, 500);
      assert.equal(error.message.includes(KEY), false);
      return true;
    });
    await assert.rejects(store.saveProvider('p2', makeProvider({ id: 'p2' })), /没有权限读取 API 配置/);
  });
});

test('imports by replacing matching providers or only adding missing ones', async () => {
  await withStore(async (store) => {
    await store.saveProvider('p1', makeProvider());
    await store.setActiveProvider('language', 'p1');
    const incoming = {
      providers: [makeProvider({ name: 'Changed' }), makeProvider({ id: 'p2', name: 'Second' })],
      activeProviderIds: { language: 'p2' },
    };

    // 旧浏览器配置迁移：已有的厂商和默认厂商都不动。
    let state = await store.importProviders(incoming, 'add-missing');
    assert.deepEqual(state.providers.map((provider) => provider.name), ['Test', 'Second']);
    assert.deepEqual(state.activeProviderIds, { language: 'p1' });

    // 用户主动导入文件：同 ID 的厂商和默认厂商以文件为准。
    state = await store.importProviders(incoming, 'replace-matching');
    assert.deepEqual(state.providers.map((provider) => provider.name), ['Changed', 'Second']);
    assert.deepEqual(state.activeProviderIds, { language: 'p2' });
    assert.equal(JSON.stringify(state).includes(KEY), false);

    await assert.rejects(store.importProviders(incoming, 'merge'), /不支持的导入方式/);
    await assert.rejects(store.importProviders({}, 'add-missing'), /导入的配置缺少厂商列表/);
  });
});

test('drops default providers that no longer exist', async () => {
  await withStore(async (store) => {
    await store.saveProvider('p1', makeProvider());
    await store.setActiveProvider('language', 'p1');
    await store.setActiveProvider('image', 'p1');
    assert.deepEqual((await store.read()).activeProviderIds, { language: 'p1' });
    assert.deepEqual((await store.removeProvider('p1')).activeProviderIds, {});
    await assert.rejects(store.setActiveProvider('audio', 'p1'), /不支持的模型类型/);
  });
});

test('resolves a saved key only for the hosts it was saved for', async () => {
  await withStore(async (store) => {
    await store.saveProvider('p1', makeProvider({
      models: [
        { id: 'text', categories: ['language'] },
        { id: 'image', categories: ['image'], baseUrlOverride: 'https://image.example/v1', apiKeyOverride: MODEL_KEY },
      ],
    }));

    assert.equal(await store.resolveStoredKey({ providerId: 'p1', scope: 'provider' }, 'https://API.example.com/v2'), KEY);
    assert.equal(await store.resolveStoredKey({ providerId: 'p1', modelId: 'image', scope: 'model' }, 'https://image.example/v1'), MODEL_KEY);

    await assert.rejects(
      store.resolveStoredKey({ providerId: 'p1', scope: 'provider' }, 'https://other.example/v1'),
      /请重新填写通用 API Key/,
    );
    await assert.rejects(
      store.resolveStoredKey({ providerId: 'p1', modelId: 'image', scope: 'model' }, 'https://api.example.com/v1'),
      /模型 image 的 Base URL 域名（host）与保存时不同/,
    );
    await assert.rejects(
      store.resolveStoredKey({ providerId: 'p1', modelId: 'text', scope: 'model' }, 'https://api.example.com/v1'),
      /已保存的 API Key 不存在/,
    );
    await assert.rejects(
      store.resolveStoredKey({ providerId: 'missing', scope: 'provider' }, 'https://api.example.com/v1'),
      /已保存的 API Key 不存在/,
    );
    await assert.rejects(
      store.resolveStoredKey({ providerId: 'p1', scope: 'provider' }, 'not a url'),
      /Base URL 格式不正确/,
    );
  });
});
