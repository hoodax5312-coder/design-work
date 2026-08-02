import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export class RelationRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(
    sourceAssetId: string,
    targetAssetId: string,
    relationType: string,
    context: Record<string, unknown> = {},
    sortOrder = 0,
    now = Date.now(),
  ) {
    const id = randomUUID();
    this.database
      .prepare(
        `
      INSERT INTO asset_relations(
        id, source_asset_id, target_asset_id, relation_type,
        sort_order, context_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(id, sourceAssetId, targetAssetId, relationType, sortOrder, JSON.stringify(context), now);
    return id;
  }

  outgoing(assetId: string, relationType?: string) {
    return relationType
      ? this.database
          .prepare(
            `
          SELECT * FROM asset_relations
          WHERE source_asset_id = ? AND relation_type = ?
          ORDER BY sort_order, created_at
        `,
          )
          .all(assetId, relationType)
      : this.database
          .prepare(
            `
          SELECT * FROM asset_relations
          WHERE source_asset_id = ? ORDER BY relation_type, sort_order, created_at
        `,
          )
          .all(assetId);
  }

  incoming(assetId: string, relationType?: string) {
    return relationType
      ? this.database
          .prepare(
            `
          SELECT * FROM asset_relations
          WHERE target_asset_id = ? AND relation_type = ?
          ORDER BY sort_order, created_at
        `,
          )
          .all(assetId, relationType)
      : this.database
          .prepare(
            `
          SELECT * FROM asset_relations
          WHERE target_asset_id = ? ORDER BY relation_type, sort_order, created_at
        `,
          )
          .all(assetId);
  }
}
