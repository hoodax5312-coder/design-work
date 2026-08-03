export interface TextNodeData extends Record<string, unknown> {
  content: string;
  mode: 'ai' | 'edit';
  prompt?: string;
  model?: string;
  providerId?: string;
  isGenerating?: boolean;
  error?: string;
  connectedImage?: string; // Node ID of connected image
}

export interface VideoNodeData extends Record<string, unknown> {
  prompt: string;
  model: string;
  generationMode?: 'text-to-video' | 'image-to-video';
  providerId?: string;
  aspectRatio: '16:9' | '21:9' | '9:16' | '1:1';
  resolution: '1080p' | '4k';
  duration: 5 | 10 | 15 | 30;
  previewUrl?: string;
  isGenerating?: boolean;
  status?: string;
  error?: string;
}

export interface AudioNodeData extends Record<string, unknown> {
  prompt: string;
  duration: 30 | 60 | 120 | 180;
  instrumental: boolean;
  waveformData: number[];
  isPlaying: boolean;
  currentTime: number;
}

export interface ImageGenNodeData extends Record<string, unknown> {
  prompt: string;
  model: string;
  generationMode?: 'text-to-image' | 'image-to-image';
  providerId?: string;
  style: string;
  cameraControl: {
    film: string;
    lens: string;
    aperture: string;
  };
  resolution: '1k' | '2k' | '4k';
  aspectRatio: '1:1' | '16:9' | '9:16' | '21:9';
  imageUrl?: string;
  isFocusMode: boolean;
  quality?: 'standard' | 'hd';
  isGenerating?: boolean;
  error?: string;
}

export interface VideoAnalyzeNodeData extends Record<string, unknown> {
  videoUrl?: string;
  threshold: number;
  keyframes?: { time: number; url: string }[];
  isExtracting: boolean;
  voiceover?: string;
  isExtractingVoiceover: boolean;
}

export interface StoryboardShot {
  id: string;
  scene: string;
  prompt: string;
  camera: string;
  duration: number;
  status: 'draft' | 'ready' | 'queued' | 'done';
}

export interface StoryboardNodeData extends Record<string, unknown> {
  script: string;
  mode: 'image' | 'video';
  shots: StoryboardShot[];
  isGenerating: boolean;
}

export interface ModelRouterNodeData extends Record<string, unknown> {
  provider: 'Jimeng' | 'ComfyUI' | 'Runway' | 'OpenAI' | 'Custom';
  model: string;
  endpoint: string;
  requestMode: 'sync' | 'async';
  keyRotation: boolean;
  blacklistCount: number;
  template: string;
}
