INSERT OR IGNORE INTO tags(id, name, color, group_name, created_at, updated_at) VALUES
  ('default-tag-commercial-product', '商业广告 & 产品', NULL, '资产分类', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  ('default-tag-brand-logo', '品牌设计 & Logo', NULL, '资产分类', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  ('default-tag-video', '视频', NULL, '资产分类', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  ('default-tag-illustration-3d', '插画 & 3D', NULL, '资产分类', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  ('default-tag-poster', '创意海报', NULL, '资产分类', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  ('default-tag-portrait', '人像摄影', NULL, '资产分类', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  ('default-tag-storyboard-character', '故事板 & 角色', NULL, '资产分类', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  ('default-tag-wallpaper', '壁纸', NULL, '资产分类', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER));
