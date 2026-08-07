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
import { Badge, Button, Input, Textarea } from '../ui';

interface InspirationDetailPanelProps {
  item: any;
  onClose?: () => void;
}

export const InspirationDetailPanel = ({ item }: InspirationDetailPanelProps) => {
  const [tags, setTags] = useState<string[]>(item?.tags || []);
  const [rating, setRating] = useState(item?.rating || 0);

  if (!item) {
    return (
      <div className="flex w-80 flex-shrink-0 flex-col items-center justify-center border-l border-border bg-card p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Folder size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-slate-800 dark:text-white mb-1">未选择创意</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">点击左侧列表中的创意查看详情</p>
      </div>
    );
  }

  return (
    <div className="flex w-80 flex-shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      {/* Top Preview */}
      <div className="aspect-video bg-slate-100 dark:bg-zinc-800 relative group">
        <img 
          src={item.image} 
          alt={item.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
           <Button variant="secondary" size="iconSm" className="shadow-sm">
             <Share size={16} className="text-slate-700 dark:text-slate-200" />
           </Button>
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
          <Input
            type="text" 
            defaultValue={item.title}
            variant="ghost" className="text-sm font-bold"
            placeholder="添加标题"
          />
          <Textarea
            placeholder="添加注释..."
            className="min-h-[80px] text-xs"
          />
        </div>

        {/* Link */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-100 dark:border-zinc-800">
            <LinkIcon size={14} className="text-slate-400 flex-shrink-0" />
            <Input
              type="text"
              placeholder="https://..."
              defaultValue={item.link || ''}
              variant="ghost" inputSize="sm" className="flex-1 truncate text-xs"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">标签</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                {tag}
                <Button variant="ghost" size="iconSm" onClick={() => setTags(tags.filter(t => t !== tag))} className="h-4 w-4 p-0 hover:text-destructive">
                  <X size={10} />
                </Button>
              </Badge>
            ))}
            <Button variant="secondary" size="sm" className="h-7 border-dashed text-xs">
              <Plus size={10} /> 添加标签
            </Button>
          </div>
        </div>

        {/* Folder */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">文件夹</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-100 dark:border-zinc-800">
             <span className="text-xs text-slate-400">未分类</span>
             <Button variant="ghost" size="iconSm" className="ml-auto h-7 w-7">
               <Plus size={14} />
             </Button>
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
        <Button variant="secondary" className="w-full">
          <Download size={16} />
          导出
        </Button>
      </div>
    </div>
  );
};
