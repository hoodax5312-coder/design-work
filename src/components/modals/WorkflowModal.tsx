import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { Layout, Video, Music, Image as ImageIcon } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui';

const categories = [
  { id: 'all', label: '所有模版', icon: Layout },
  { id: 'video', label: '视频制作', icon: Video },
  { id: 'audio', label: '音频生成', icon: Music },
  { id: 'image', label: '图像合成', icon: ImageIcon },
];

const templates = [
  { id: 1, title: '文本转视频故事', category: 'video', image: 'bg-muted' },
  { id: 2, title: '音乐视频生成', category: 'audio', image: 'bg-muted' },
  { id: 3, title: '角色设计', category: 'image', image: 'bg-muted' },
  { id: 4, title: '社交媒体帖子', category: 'video', image: 'bg-muted' },
  { id: 5, title: '播客封面', category: 'image', image: 'bg-muted' },
  { id: 6, title: '环境音效', category: 'audio', image: 'bg-muted' },
];

export const WorkflowModal = () => {
  const { modalOpen, closeModal } = useUIStore();
  const [activeCategory, setActiveCategory] = React.useState('all');

  const filteredTemplates = activeCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === activeCategory);

  return (
    <Dialog open={modalOpen === 'workflow'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="flex h-[min(680px,calc(100dvh-32px))] w-[min(960px,calc(100vw-32px))] max-w-none gap-0 overflow-hidden p-0">
          
          {/* Left Sidebar */}
          <div className="flex w-60 shrink-0 flex-col border-r bg-muted/30 p-5">
            <DialogHeader className="mb-6 text-left">
              <DialogTitle>新建工作流</DialogTitle>
              <DialogDescription>从一个结构化模板开始创作。</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {categories.map((cat) => (
                <Button
                  type="button"
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  variant="ghost"
                  className={cn(
                    'w-full justify-start',
                    activeCategory === cat.id 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  <cat.icon size={18} />
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Right Content */}
          <div className="min-w-0 flex-1 bg-background p-7">
            <div className="mb-6"><h3 className="text-lg font-semibold tracking-tight">选择模版</h3><p className="mt-1 text-sm text-muted-foreground">选择后可继续修改节点和生成参数。</p></div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <Card
                  role="button"
                  tabIndex={0}
                  key={template.id}
                  onClick={closeModal}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') closeModal(); }}
                  padding="none"
                  className="group relative aspect-[4/3] overflow-hidden rounded-md border bg-card text-left transition-[border-color] hover:border-foreground/25"
                >
                  <div className={cn("absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity", template.image)} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
                    <h4 className="font-medium text-white transition-colors group-hover:text-primary">{template.title}</h4>
                    <p className="mt-1 text-xs text-white/60">从模版开始</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

        </DialogContent>
    </Dialog>
  );
};
