import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

export type SmartCollectionField =
  | 'type'
  | 'favorite'
  | 'rating'
  | 'status'
  | 'folderId'
  | 'createdAt'
  | 'tagId'
  | 'author';
export type SmartCollectionOperator = 'eq' | 'in' | 'gte' | 'lte' | 'contains' | 'isEmpty';

export interface SmartCollectionCondition {
  field: SmartCollectionField;
  operator: SmartCollectionOperator;
  value?: unknown;
}

export interface SmartCollectionRules {
  match: 'all' | 'any';
  conditions: SmartCollectionCondition[];
}

const assertString = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('智能集合规则需要字符串值');
  return value;
};

const assertNumber = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('智能集合规则需要数字值');
  return value;
};

export const compileSmartCollectionRules = (rules: SmartCollectionRules) => {
  if (!rules || !['all', 'any'].includes(rules.match) || !Array.isArray(rules.conditions)) {
    throw new Error('智能集合规则格式无效');
  }
  if (rules.conditions.length > 20) throw new Error('智能集合最多支持 20 条规则');
  const fragments: string[] = [];
  const parameters: SQLInputValue[] = [];

  for (const condition of rules.conditions) {
    switch (condition.field) {
      case 'type':
      case 'status':
      case 'folderId': {
        const column =
          condition.field === 'folderId' ? 'a.primary_folder_id' : `a.${condition.field}`;
        if (condition.operator === 'isEmpty' && condition.field === 'folderId') {
          fragments.push(`${column} IS NULL`);
        } else if (condition.operator === 'eq') {
          fragments.push(`${column} = ?`);
          parameters.push(assertString(condition.value));
        } else if (
          condition.operator === 'in' &&
          Array.isArray(condition.value) &&
          condition.value.length
        ) {
          const values = condition.value.map(assertString).slice(0, 20);
          fragments.push(`${column} IN (${values.map(() => '?').join(', ')})`);
          parameters.push(...values);
        } else {
          throw new Error(`不支持的智能集合操作：${condition.field}/${condition.operator}`);
        }
        break;
      }
      case 'favorite':
        if (condition.operator !== 'eq' || typeof condition.value !== 'boolean')
          throw new Error('收藏规则只支持布尔等于');
        fragments.push('a.favorite = ?');
        parameters.push(condition.value ? 1 : 0);
        break;
      case 'rating':
      case 'createdAt': {
        if (!['eq', 'gte', 'lte'].includes(condition.operator))
          throw new Error('数字规则只支持 eq/gte/lte');
        const column = condition.field === 'rating' ? 'a.rating' : 'a.created_at';
        const operator =
          condition.operator === 'gte' ? '>=' : condition.operator === 'lte' ? '<=' : '=';
        fragments.push(`${column} ${operator} ?`);
        parameters.push(assertNumber(condition.value));
        break;
      }
      case 'tagId':
        if (condition.operator !== 'eq') throw new Error('标签规则只支持等于');
        fragments.push(`EXISTS (
          SELECT 1 FROM asset_tags smart_tag WHERE smart_tag.asset_id = a.id AND smart_tag.tag_id = ?
        )`);
        parameters.push(assertString(condition.value));
        break;
      case 'author':
        if (condition.operator !== 'contains') throw new Error('作者规则只支持包含');
        fragments.push("COALESCE(a.author, '') LIKE ? ESCAPE '\\'");
        parameters.push(`%${assertString(condition.value).replace(/[\\%_]/g, '\\$&')}%`);
        break;
      default:
        throw new Error('未允许的智能集合字段');
    }
  }
  return {
    sql: fragments.length
      ? `(${fragments.join(rules.match === 'all' ? ' AND ' : ' OR ')})`
      : '1 = 1',
    parameters,
  };
};

const mapCollection = (row: Record<string, unknown>) => ({
  id: String(row.id),
  name: String(row.name),
  rules: JSON.parse(String(row.rules_json)) as SmartCollectionRules,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

export class SmartCollectionRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(name: string, rules: SmartCollectionRules, now = Date.now()) {
    compileSmartCollectionRules(rules);
    const id = randomUUID();
    this.database
      .prepare(
        `
      INSERT INTO smart_collections(id, name, rules_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(id, name.trim(), JSON.stringify(rules), now, now);
    return this.get(id);
  }

  get(id: string) {
    const row = this.database.prepare('SELECT * FROM smart_collections WHERE id = ?').get(id);
    return row ? mapCollection(row) : null;
  }

  list() {
    return this.database
      .prepare('SELECT * FROM smart_collections ORDER BY name COLLATE NOCASE')
      .all()
      .map(mapCollection);
  }

  update(id: string, input: { name?: string; rules?: SmartCollectionRules }, now = Date.now()) {
    const current = this.get(id);
    if (!current) throw new Error('智能集合不存在');
    const rules = input.rules || current.rules;
    compileSmartCollectionRules(rules);
    this.database
      .prepare(
        `
      UPDATE smart_collections SET name = ?, rules_json = ?, updated_at = ? WHERE id = ?
    `,
      )
      .run((input.name || current.name).trim(), JSON.stringify(rules), now, id);
    return this.get(id);
  }

  remove(id: string) {
    this.database.prepare('DELETE FROM smart_collections WHERE id = ?').run(id);
  }

  evaluate(id: string, limit = 100, offset = 0) {
    const collection = this.get(id);
    if (!collection) throw new Error('智能集合不存在');
    const compiled = compileSmartCollectionRules(collection.rules);
    return this.database
      .prepare(
        `
      SELECT id FROM assets a WHERE a.status <> 'deleted' AND ${compiled.sql}
      ORDER BY a.updated_at DESC, a.id LIMIT ? OFFSET ?
    `,
      )
      .all(...compiled.parameters, Math.min(Math.max(limit, 1), 500), Math.max(offset, 0))
      .map((row) => String(row.id));
  }
}
