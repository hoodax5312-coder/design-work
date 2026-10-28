import assert from 'node:assert/strict';
import test from 'node:test';
import { modelOptionsFor, resolveModelChoice } from '../src/components/canvas/generation';
import type { ProviderConfig } from '../src/types/provider';

const provider = (id: string): ProviderConfig => ({
  id, name: id, protocol: 'chat-completions', baseUrl: 'https://example.com/v1', apiKey: '',
  models: [{ id: `${id}-text`, categories: ['language'] }, { id: `${id}-image`, categories: ['image'] }],
  selectedModels: { language: `${id}-text`, image: `${id}-image` },
});
const providers = [provider('enabled'), provider('disabled')];

test('模型菜单仅展示对应类型启用API的模型', () => {
  assert.deepEqual(modelOptionsFor(providers, 'language', 'enabled').map((option) => option.model), ['enabled-text']);
  assert.deepEqual(modelOptionsFor(providers, 'image', 'disabled').map((option) => option.model), ['disabled-image']);
  assert.deepEqual(modelOptionsFor(providers, 'video', 'enabled'), []);
});

test('已保存节点引用停用API时回落到启用API，不继续请求停用厂商', () => {
  const choice = resolveModelChoice({ providerId: 'disabled', model: 'disabled-text' }, 'language', providers, 'enabled');
  assert.equal(choice.provider?.id, 'enabled');
  assert.equal(choice.model, 'enabled-text');
});

test('未启用任何API或已启用厂商失效时不展示也不回退到未启用厂商', () => {
  for (const active of [undefined, 'removed']) {
    const choice = resolveModelChoice({}, 'language', providers, active);
    assert.equal(choice.provider, undefined);
    assert.equal(choice.model, '');
    assert.deepEqual(choice.options, []);
  }
});
