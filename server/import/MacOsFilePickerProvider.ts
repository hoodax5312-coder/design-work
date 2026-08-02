import { execFile } from 'node:child_process';
import path from 'node:path';
import { FilePickerCancelledError, type FilePickerProvider } from './FilePickerProvider';

type ScriptExecutor = (arguments_: string[]) => Promise<string>;

const defaultExecutor: ScriptExecutor = (arguments_) =>
  new Promise((resolve, reject) => {
    execFile('osascript', arguments_, { encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });

const FILE_SCRIPT = `
set selectedFiles to choose file with prompt "选择要导入 Mboard 的文件" with multiple selections allowed
set output to ""
repeat with selectedFile in selectedFiles
  set output to output & POSIX path of selectedFile & linefeed
end repeat
return output
`;

const DIRECTORY_SCRIPT = 'POSIX path of (choose folder with prompt "选择要导入 Mboard 的文件夹")';

const isCancelled = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('User canceled') || message.includes('(-128)');
};

const parseAbsolutePaths = (stdout: string) =>
  stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (!path.isAbsolute(value)) throw new Error('文件选择器返回了非绝对路径');
      return path.normalize(value);
    });

export class MacOsFilePickerProvider implements FilePickerProvider {
  constructor(private readonly execute: ScriptExecutor = defaultExecutor) {}

  async pickFiles() {
    try {
      return parseAbsolutePaths(await this.execute(['-e', FILE_SCRIPT]));
    } catch (error) {
      if (isCancelled(error)) throw new FilePickerCancelledError();
      throw error;
    }
  }

  async pickDirectory() {
    try {
      return parseAbsolutePaths(await this.execute(['-e', DIRECTORY_SCRIPT]))[0] || null;
    } catch (error) {
      if (isCancelled(error)) throw new FilePickerCancelledError();
      throw error;
    }
  }
}
