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
    <div className="ui-module-frame h-full w-full text-foreground transition-colors">
      {/* Left Panel - Controls */}
      <div
        style={{ width: controlWidth }}
        className="ui-module-panel flex shrink-0 flex-col gap-4 overflow-y-auto p-4"
      >
        {controlPanel}
      </div>

      {/* Right Panel - Preview */}
      <div className="ui-module-panel flex min-w-0 flex-1 flex-col p-4">
        {previewPanel}
      </div>
    </div>
  );
}
