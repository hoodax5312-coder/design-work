export interface PreviewRequest {
  sourcePath: string;
  outputPath: string;
  maxWidth: number;
  maxHeight: number;
}

export interface PreviewResult {
  format: string;
  width: number;
  height: number;
  fileSize: number;
  sourceWidth: number | null;
  sourceHeight: number | null;
  sourcePages: number;
  sourceOrientation: number | null;
  hasAlpha: boolean;
}

export interface PreviewProvider {
  readonly id: string;
  readonly version: string;
  generate(request: PreviewRequest): Promise<PreviewResult>;
}
