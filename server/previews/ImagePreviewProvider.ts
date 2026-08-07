import sharp from 'sharp';
import type { PreviewProvider, PreviewRequest } from './PreviewProvider';

const MAX_INPUT_PIXELS = 80_000_000;

const createPipeline = (sourcePath: string) =>
  sharp(sourcePath, {
    failOn: 'warning',
    limitInputPixels: MAX_INPUT_PIXELS,
    unlimited: false,
    sequentialRead: true,
    pages: 1,
    page: 0,
  });

export class ImagePreviewProvider implements PreviewProvider {
  readonly id = 'sharp-image';
  readonly version = 'sharp-0.34.4-v1';

  async generate(request: PreviewRequest) {
    const metadata = await createPipeline(request.sourcePath).metadata();
    const output = await createPipeline(request.sourcePath)
      .rotate()
      .resize({
        width: request.maxWidth,
        height: request.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, alphaQuality: 90, effort: 4 })
      .timeout({ seconds: 30 })
      .toFile(request.outputPath);

    return {
      format: output.format,
      width: output.width,
      height: output.height,
      fileSize: output.size,
      sourceWidth: metadata.width ?? null,
      sourceHeight: metadata.height ?? null,
      sourcePages: metadata.pages ?? 1,
      sourceOrientation: metadata.orientation ?? null,
      hasAlpha: metadata.hasAlpha ?? false,
    };
  }
}
