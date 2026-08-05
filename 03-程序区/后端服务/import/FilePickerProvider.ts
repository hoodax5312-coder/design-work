export class FilePickerCancelledError extends Error {
  constructor() {
    super('用户取消了文件选择');
  }
}

export interface FilePickerProvider {
  pickFiles(): Promise<string[]>;
  pickDirectory(): Promise<string | null>;
}
