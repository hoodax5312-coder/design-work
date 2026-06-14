import { type ReactNode } from 'react';

interface GenerationLayoutProps {
  controlPanel: ReactNode;
  previewPanel: ReactNode;
  controlWidth?: number;
}

export function GenerationLayout({
  controlPanel,
  previewPanel,
  controlWidth = 360,
}: GenerationLayoutProps) {
  return (
    <div className="flex w-full h-full gap-2 p-2 bg-white dark:bg-black transition-colors">
      {/* Left Panel - Controls */}
      <div
        style={{ width: controlWidth }}
        className="flex-shrink-0 flex flex-col gap-4 bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm overflow-y-auto"
      >
        {controlPanel}
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm min-w-0">
        {previewPanel}
      </div>
    </div>
  );
}
