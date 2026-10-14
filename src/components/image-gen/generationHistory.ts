export interface GenerationRecord {
  id: string;
  prompt: string;
  createdAt: string;
  model: string;
  ratio: string;
  resolution: string;
  quality: string;
  duration?: number;
  outputs: string[];
  mode?: 'image' | 'video';
}

export interface GenerationHistoryCache {
  image: GenerationRecord[];
  video: GenerationRecord[];
}

export const normalizeGenerationHistory = (cache: GenerationHistoryCache): GenerationHistoryCache => {
  const normalized: GenerationHistoryCache = { image: [], video: [] };

  (['image', 'video'] as const).forEach((sourceMode) => {
    cache[sourceMode].forEach((record) => {
      const mode = record.mode ?? sourceMode;
      normalized[mode].push({ ...record, mode });
    });
  });

  return normalized;
};
