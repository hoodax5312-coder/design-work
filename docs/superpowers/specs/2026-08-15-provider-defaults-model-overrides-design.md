# 厂商通用配置与模型级覆盖设计

## 背景

当前 Provider 配置按文本、生图、视频拆成三套完整连接。虽然能彻底隔离请求，但同一厂商通常共享上游格式、Base URL 和 API Key，重复填写会增加配置成本，也不利于集中维护。

本次改为“厂商通用连接 + 模型级可选覆盖”：厂商提供默认连接，每个模型默认继承，仅在确有差异时覆盖自己的 Base URL 和 API Key。文本、生图、视频仍分别选择活动厂商和默认模型。

## 目标

- 每个厂商只维护一套通用上游格式、Base URL 和 API Key。
- 每个模型始终展示其最终使用的 Base URL 和 API Key 来源。
- 模型可以仅覆盖 Base URL、仅覆盖 API Key，或同时覆盖两者。
- 模型不能覆盖上游格式；上游格式始终继承厂商通用配置。
- 文本、生图、视频继续独立启用厂商和选择默认模型。
- 连接测试只验证鉴权、Base URL 和模型列表，不触发生成费用。
- 旧配置迁移后尽量保持原有请求参数和活动厂商关系。

## 不在范围内

- 不增加音乐、语音或工具模型类型。
- 不增加 Key 标签库、多 Key 轮询、负载均衡或自动故障转移。
- 不允许模型覆盖上游协议。
- 不执行真实文本、生图或视频生成作为连接测试。

## 数据模型

```ts
type ModelCategory = 'language' | 'image' | 'video';

interface ProviderModel {
  id: string;
  categories: ModelCategory[];
  baseUrlOverride?: string;
  apiKeyOverride?: string;
  verification?: ProviderVerification;
}

interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  models: ProviderModel[];
  selectedModels: Partial<Record<ModelCategory, string>>;
  savedAt?: number;
}

interface ProviderStateSnapshot {
  providers: ProviderConfig[];
  activeProviderIds: Partial<Record<ModelCategory, string>>;
}
```

模型覆盖字段为空或不存在时表示继承通用配置。界面中的继承状态统一显示为“默认”，持久化数据不保存字符串 `default`，避免将展示值误当成真实 URL 或 Key。

## 连接解析

所有测试和生成请求必须通过同一个纯函数解析连接，不允许调用方自行拼接：

```ts
resolveModelConnection(provider, modelId, category) => {
  protocol: provider.protocol,
  baseUrl: model.baseUrlOverride || provider.baseUrl,
  apiKey: model.apiKeyOverride || provider.apiKey,
  model: model.id,
  category,
}
```

解析规则：

1. 模型必须属于请求的能力类型。
2. 模型覆盖值非空时优先使用覆盖值。
3. 覆盖值为空时使用厂商通用值。
4. 上游格式始终使用厂商通用格式。
5. 不跨模型、不跨类型、不跨厂商回退。
6. 缺少最终 URL、Key 或模型 ID 时，在请求发出前返回明确错误。

## 设置页结构

### 厂商通用区

编辑页顶部展示：

- 厂商名称
- 上游格式
- 通用 Base URL
- 通用 API Key
- 通用连接测试与状态

通用连接测试只请求模型列表，并报告列表是否可访问及发现数量；不自动添加或分类模型，模型仍由用户在对应类型标签中添加。

### 模型类型标签

通用区下方保留“文本 / 生图 / 视频”顶部标签。标签只用于筛选模型卡，并显示对应模型数量，不再切换连接配置。

在某个标签中新增模型时，模型自动获得当前能力类型。已有模型可以拥有多个能力类型；相同模型 ID 在一个厂商内只保存一份。

### 模型卡

每张模型卡始终展示：

- 模型 ID
- 能力类型
- 是否为当前类型的默认模型
- API Key
- Base URL
- 验证状态
- 测试连接操作
- 删除操作

API Key 和 Base URL 使用“默认 / 自定义”来源选择：

- `默认`：展示继承后的通用值；URL 可读，Key 仅显示掩码；字段不可直接编辑。
- `自定义`：字段可编辑并保存为模型覆盖值。

从“自定义”切回“默认”时清除对应覆盖字段。API Key 不在页面错误、日志、健康记录或任务记录中显示明文。

厂商名称、通用上游格式、通用 Base URL 和通用 API Key 均为必填。模型字段切换为“自定义”后，对应覆盖值也必须填写完整才能保存。

模型卡测试使用解析后的最终连接，只请求模型列表。测试结果只更新该模型的验证状态。

## 分类启用与模型选择

- `activeProviderIds.language`、`activeProviderIds.image`、`activeProviderIds.video` 继续独立保存。
- 每个厂商通过 `selectedModels` 保存三类默认模型。
- 启用某类厂商前，必须确保该厂商至少存在一个支持该类型的模型。
- 健康状态不是 `healthy` 时显示包含类型、Host 和状态的确认警告；用户确认后仍可启用。
- 生成页面与画布只读取当前类型的活动厂商和默认模型。

## 状态失效规则

- 修改通用上游格式：所有模型标记为“待重新验证”。
- 修改通用 Base URL：所有继承通用 URL 的模型标记为“待重新验证”。
- 修改通用 API Key：所有继承通用 Key 的模型标记为“待重新验证”。
- 修改模型 ID、能力类型、覆盖 URL 或覆盖 Key：仅该模型标记为“待重新验证”。
- 使用完整自定义 URL 和 Key 的模型不因通用 URL 或 Key 修改而失效。

验证状态包含 `pending`、`healthy`、`unhealthy`、`unverified`。上游不支持模型列表接口时保留手动模型并标记 `unverified`；鉴权失败、Host 错误或响应异常标记 `unhealthy`。

## v5 到 v6 迁移

当前 v5 数据按能力类型保存完整连接。v6 迁移按以下步骤执行：

1. 将同一 Provider 的连接按上游格式分组。
2. 模型数量最多的格式组保留原 Provider ID 和名称；其他格式组拆成新的 Provider，名称追加格式标签。
3. 每个格式组内，选择承载模型数量最多的 `Base URL + API Key` 组合为通用配置。
4. 其他连接中的模型写入 URL、Key 覆盖，以保持原有请求目标。
5. 相同模型 ID 合并能力类型；出现冲突时保留第一个有效连接并标记“待重新验证”。
6. 分类活动厂商 ID 映射到承载该分类模型的新 Provider。
7. 所有迁移模型统一标记“待重新验证”。

导入导出格式升级为版本 3。导入 v1、v2 或当前 v5 持久化数据时复用同一迁移入口，导入后的验证状态统一设为 `pending`。

## 错误与安全

- 网关继续对精确 Key、Bearer Token、`api-key` 参数和常见长 Token 模式脱敏。
- 错误上下文包含模型类型、Host 和状态码，不包含请求头或 Key 片段。
- 模型卡只保存脱敏后的错误文本。
- 导出文件包含 Key 时继续显示明确警告。
- 不在浏览器回归中填写、读取或输出真实 API Key。

## 测试与验收

### 单元测试

- 默认配置解析。
- 仅覆盖 URL、仅覆盖 Key、同时覆盖两者。
- 模型类型不匹配时拒绝请求。
- v5 到 v6 的通用值选择、覆盖生成、协议拆分和活动厂商映射。
- 修改通用字段后的精确状态失效范围。
- 错误中的完整与掩码 Key 脱敏。

### 集成测试

- 文本、生图、视频请求分别读取对应活动厂商和默认模型。
- 请求体只包含当前模型解析后的连接，不包含其他模型或厂商的 Key。
- 连接测试只调用 `/models`，不调用任何生成端点。

### 浏览器验收

1. 通用配置始终位于模型标签上方。
2. 三个标签只筛选模型，不改变通用连接字段。
3. 每张模型卡始终显示 URL 和 Key，并以“默认”或“自定义”标识来源。
4. 切换为自定义后只影响当前模型；切回默认后恢复继承。
5. 三类可以分别启用不同厂商。
6. 旧配置迁移后模型数量、类型、默认模型和请求目标保持一致。
7. 上游错误不显示任何 API Key 片段。

## 完成标准

- 数据模型、迁移、设置页和所有调用方统一使用模型级解析器。
- 不再保留按能力类型重复保存完整连接的代码路径。
- 专项测试、客户端与服务端类型检查、本次涉及文件的 Lint、生产构建通过。
- 本地浏览器完成无费用交互回归。
