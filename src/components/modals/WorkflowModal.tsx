import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useUIStore } from '../../stores/useUIStore';
import { X, Layout, Video, Music, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

const categories = [
  { id: 'all', label: '所有模版', icon: Layout },
  { id: 'video', label: '视频制作', icon: Video },
  { id: 'audio', label: '音频生成', icon: Music },
  { id: 'image', label: '图像合成', icon: ImageIcon },
];

const templates = [
  { id: 1, title: '文本转视频故事', category: 'video', image: 'bg-gradient-to-br from-purple-500 to-indigo-600' },
  { id: 2, title: '音乐视频生成', category: 'audio', image: 'bg-gradient-to-br from-cyan-500 to-blue-600' },
  { id: 3, title: '角色设计', category: 'image', image: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  { id: 4, title: '社交媒体帖子', category: 'video', image: 'bg-gradient-to-br from-pink-500 to-rose-600' },
  { id: 5, title: '播客封面', category: 'image', image: 'bg-gradient-to-br from-orange-500 to-red-600' },
  { id: 6, title: '环境音效', category: 'audio', image: 'bg-gradient-to-br from-indigo-500 to-violet-600' },
];

export const WorkflowModal = () => {
  const { modalOpen, closeModal } = useUIStore();
  const [activeCategory, setActiveCategory] = React.useState('all');

  const filteredTemplates = activeCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === activeCategory);

  return (
    <Dialog.Root open={modalOpen === 'workflow'} onOpenChange={(open) => !open && closeModal()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[900px] h-[600px] glass-panel z-50 p-0 flex overflow-hidden outline-none animate-fade-in">
          
          {/* Left Sidebar */}
          <div className="w-64 bg-zinc-900/50 border-r border-white/10 p-6 flex flex-col">
            <h2 className="text-xl font-bold text-white mb-6">新建工作流</h2>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                    activeCategory === cat.id 
                      ? "bg-accent-cyan/10 text-accent-cyan" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <cat.icon size={18} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 p-8 bg-zinc-950/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">选择模版</h3>
              <Dialog.Close asChild>
                <button className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <button 
                  key={template.id}
                  onClick={closeModal}
                  className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-white/10 hover:border-accent-cyan/50 transition-all text-left"
                >
                  <div className={cn("absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity", template.image)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h4 className="text-white font-medium group-hover:text-accent-cyan transition-colors">{template.title}</h4>
                    <p className="text-xs text-zinc-400 mt-1">从模版开始</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
