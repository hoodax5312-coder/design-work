import assert from 'node:assert/strict';
import test from 'node:test';
import {
  invalidateProviderModels,
  migrateProviderStateV6,
  resolveModelConnection,
  setModelsInCategory,
} from '../src/lib/providerConnections';
import type { ProviderConfig } from '../src/types/provider';

const provider: ProviderConfig = {
  id: 'mixed',
  name: 'Mixed',
  protocol: 'chat-completions',
  baseUrl: 'https://default.example/v1',
  apiKey: 'default-key',
  models: [
    { id: 'default-model', categories: ['language'] },
    {
      id: 'override-model',
      categories: ['image'],
      baseUrlOverride: 'https://image.example/v1',
      apiKeyOverride: 'image-key',
    },
  ],
  selectedModels: { language: 'default-model', image: 'override-model' },
};

test('resolves model URL and Key independently from provider defaults', () => {
  assert.deepEqual(resolveModelConnection(provider, 'language'), {
    category: 'language',
    protocol: 'chat-completions',
    baseUrl: 'https://default.example/v1',
    apiKey: 'default-key',
    model: 'default-model',
  });
  assert.equal(resolveModelConnection(provider, 'image')?.baseUrl, 'https://image.example/v1');
  assert.equal(resolveModelConnection(provider, 'image')?.apiKey, 'image-key');
  assert.equal(resolveModelConnection(provider, 'video'), undefined);
});

test('invalidates only models inheriting the changed Provider field', () => {
  const healthy: ProviderConfig = {
    ...provider,
    models: provider.models.map((model) => ({
      ...model,
      verification: { status: 'healthy' as const },
    })),
  };
  const afterUrl = invalidateProviderModels(healthy, 'baseUrl');
  assert.equal(afterUrl.models[0].verification?.status, 'pending');
  assert.equal(afterUrl.models[1].verification?.status, 'healthy');
  const afterProtocol = invalidateProviderModels(healthy, 'protocol');
  assert.equal(afterProtocol.models.every((model) => model.verification?.status === 'pending'), true);
});

test('migrates v5 category connections into defaults and model overrides', () => {
  const migrated = migrateProviderStateV6({
    providers: [{
      id: 'legacy',
      name: 'Legacy',
      connections: {
        language: {
          protocol: 'chat-completions',
          baseUrl: 'https://default.example/v1',
          apiKey: 'default-key',
          models: ['text-a', 'text-b'],
          selectedModel: 'text-a',
        },
        image: {
          protocol: 'chat-completions',
          baseUrl: 'https://image.example/v1',
          apiKey: 'image-key',
          models: ['image-a'],
          selectedModel: 'image-a',
        },
      },
    }],
    activeProviderIds: { language: 'legacy', image: 'legacy' },
  });

  assert.equal(migrated.providers.length, 1);
  assert.equal(migrated.providers[0].baseUrl, 'https://default.example/v1');
  assert.equal(migrated.providers[0].apiKey, 'default-key');
  const image = migrated.providers[0].models.find((model) => model.id === 'image-a');
  assert.equal(image?.baseUrlOverride, 'https://image.example/v1');
  assert.equal(image?.apiKeyOverride, 'image-key');
  assert.equal(image?.verification?.status, 'pending');
  assert.deepEqual(migrated.activeProviderIds, { language: 'legacy', image: 'legacy' });
});

test('splits legacy Providers when category connections use different protocols', () => {
  const migrated = migrateProviderStateV6({
    providers: [{
      id: 'legacy',
      name: 'Legacy',
      connections: {
        language: {
          protocol: 'anthropic-messages', baseUrl: 'https://anthropic.example/v1',
          apiKey: 'text-key', models: ['claude'], selectedModel: 'claude',
        },
        image: {
          protocol: 'chat-completions', baseUrl: 'https://image.example/v1',
          apiKey: 'image-key', models: ['image'], selectedModel: 'image',
        },
      },
    }],
    activeProviderIds: { language: 'legacy', image: 'legacy' },
  });
  assert.equal(migrated.providers.length, 2);
  assert.notEqual(migrated.activeProviderIds.language, migrated.activeProviderIds.image);
  assert.equal(
    migrated.providers.find((item) => item.id === migrated.activeProviderIds.image)?.protocol,
    'chat-completions',
  );
});

test('adds fetched models to a category without touching existing ones', () => {
  const verification = { status: 'healthy' as const, checkedAt: 1, latency: 20 };
  const next = setModelsInCategory(provider, 'image', ['default-model', 'new-image', 'new-image', ' '], true, verification);
  assert.deepEqual(next.models.map((model) => [model.id, model.categories]), [
    ['default-model', ['language', 'image']],
    ['override-model', ['image']],
    ['new-image', ['image']],
  ]);
  // 已有模型只补类型，保留原来的连接覆盖和验证状态；新模型带上本次验证结果。
  assert.equal(next.models[0].verification, undefined);
  assert.equal(next.models[1].apiKeyOverride, 'image-key');
  assert.deepEqual(next.models[2].verification, verification);
  assert.equal(next.selectedModels.image, 'override-model');

  const video = setModelsInCategory(provider, 'video', ['clip-b', 'clip-a'], true);
  assert.deepEqual(video.models.slice(2).map((model) => model.id), ['clip-b', 'clip-a']);
  assert.deepEqual(video.models[2].verification, { status: 'pending' });
  assert.equal(video.selectedModels.video, 'clip-b');
});

test('removing models from a category deletes orphans and moves the default', () => {
  const shared = setModelsInCategory(provider, 'image', ['default-model', 'extra-image'], true);
  const next = setModelsInCategory(shared, 'image', ['override-model', 'default-model'], false);
  assert.deepEqual(next.models.map((model) => [model.id, model.categories]), [
    ['default-model', ['language']],
    ['extra-image', ['image']],
  ]);
  assert.equal(next.selectedModels.image, 'extra-image');
  assert.equal(next.selectedModels.language, 'default-model');

  const empty = setModelsInCategory(next, 'image', ['extra-image'], false);
  assert.equal('image' in empty.selectedModels, false);
  assert.deepEqual(empty.models.map((model) => model.id), ['default-model']);
});
