import { useState } from 'react';
import {
  Share,
  Link as LinkIcon,
  Plus,
  X,
  Star,
  Download,
  Folder
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface InspirationDetailPanelProps {
  item: any;
  onClose?: () => void;
}

export const InspirationDetailPanel = ({ item }: InspirationDetailPanelProps) => {
  const [tags, setTags] = useState<string[]>(item?.tags || []);
  const [rating, setRating] = useState(item?.rating || 0);

  if (!item) {
    return (
      <div className="w-80 flex-shrink-0 bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
          <Folder size={24} className="text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-800 dark:text-white mb-1">未选择创意</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">点击左侧列表中的创意查看详情</p>
      </div>
    );
  }

  return (
    <div className="w-80 flex-shrink-0 bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
      {/* Top Preview */}
      <div className="aspect-video bg-slate-100 dark:bg-zinc-800 relative group">
        <img 
          src={item.image} 
          alt={item.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
           <button className="p-2 bg-white/90 dark:bg-zinc-800/90 rounded-lg shadow-sm hover:scale-105 transition-transform">
             <Share size={16} className="text-slate-700 dark:text-slate-200" />
           </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Colors Palette */}
        <div className="flex gap-2">
          {['#1d2531', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'].map((color) => (
            <div 
              key={color} 
              className="w-6 h-6 rounded-full border border-slate-200 dark:border-zinc-700 shadow-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Title & Desc */}
        <div className="space-y-3">
          <input 
            type="text" 
            defaultValue={item.title}
            className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-white border-none p-0 focus:ring-0 placeholder:text-slate-400"
            placeholder="添加标题"
          />
          <textarea 
            placeholder="添加注释..."
            className="w-full min-h-[80px] text-xs bg-slate-50 dark:bg-zinc-800/50 rounded-lg p-3 border-none resize-none focus:ring-1 focus:ring-indigo-500/50 text-slate-600 dark:text-slate-300 placeholder:text-slate-400"
          />
        </div>

        {/* Link */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-100 dark:border-zinc-800">
            <LinkIcon size={14} className="text-slate-400 flex-shrink-0" />
            <input 
              type="text"
              placeholder="https://..."
              defaultValue={item.link || ''}
              className="flex-1 bg-transparent border-none p-0 text-xs text-slate-600 dark:text-slate-300 focus:ring-0 truncate"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">标签</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <div key={tag} className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded text-xs text-slate-600 dark:text-slate-300">
                {tag}
                <button onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-500">
                  <X size={10} />
                </button>
              </div>
            ))}
            <button className="flex items-center gap-1 px-2 py-1 border border-dashed border-slate-300 dark:border-zinc-600 rounded text-xs text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
              <Plus size={10} /> 添加标签
            </button>
          </div>
        </div>

        {/* Folder */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">文件夹</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-100 dark:border-zinc-800">
             <span className="text-xs text-slate-400">未分类</span>
             <button className="ml-auto text-slate-400 hover:text-slate-600">
               <Plus size={14} />
             </button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">基本信息</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">评分</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star 
                    key={i} 
                    size={12} 
                    className={cn(
                      "cursor-pointer transition-colors",
                      i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-zinc-700"
                    )}
                    onClick={() => setRating(i)}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">尺寸</span>
              <span className="text-slate-600 dark:text-slate-300">1728 × 897</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">文件大小</span>
              <span className="text-slate-600 dark:text-slate-300">500.59 KB</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">格式</span>
              <span className="text-slate-600 dark:text-slate-300">PNG</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">添加日期</span>
              <span className="text-slate-600 dark:text-slate-300">2026/02/03 17:13</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-zinc-800">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-200 rounded-lg transition-colors text-sm font-medium">
          <Download size={16} />
          导出
        </button>
      </div>
    </div>
  );
};
