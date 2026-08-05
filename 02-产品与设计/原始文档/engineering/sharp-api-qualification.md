# Sharp API 准入记录

日期：2026-07-27  
项目版本：`sharp@0.34.4`  
内置 libvips：`8.17.2`

## 允许使用的 API

以已安装包的 `node_modules/sharp/lib/index.d.ts` 为唯一签名依据：

- `sharp(input, options)`：仅传入本地文件路径；必须设置 `failOn`、`limitInputPixels`、`unlimited: false`、`sequentialRead: true` 和单页策略。
- `metadata(): Promise<Metadata>`：读取格式、尺寸、EXIF orientation、页数和 alpha 信息。
- `rotate(): Sharp`：无参数调用，按 EXIF orientation 自动旋转/镜像。
- `resize(options: ResizeOptions): Sharp`：仅使用 `fit: 'inside'`、`withoutEnlargement: true` 和固定宽高上限。
- `webp(options?: WebpOptions): Sharp`：保留透明通道的默认预览输出。
- `jpeg(options?: JpegOptions): Sharp`：只用于明确不需要 alpha 的降级输出。
- `toFile(fileOut: string): Promise<OutputInfo>`：只允许写入 `task-temp` 中的临时文件，成功后再原子重命名。
- `timeout({ seconds })`：限制单个图像处理时间。

## 安全与降级规则

- 像素上限固定为 80,000,000，不使用 `unlimited: true`。
- GIF/TIFF 等多帧输入首期只生成第一帧预览，原始页数保存为元数据。
- HEIC 能力以当前 Sharp/libvips 实际解码结果为准；不可用错误缩略图伪装成功。
- 损坏文件、超大像素图和不支持格式必须返回可诊断失败，不留下最终缓存文件。
