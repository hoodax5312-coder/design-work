import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Upload, Save, User, MapPin, Box, Palette, Wrench, MoreHorizontal } from 'lucide-react';

interface InspirationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSave?: (item: any) => void;
}

export const InspirationModal = ({ isOpen, onClose, initialData, onSave }: InspirationModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription('一个干净的 3x3 故事板风格，包含九个等大的面板，整体宽高比为 4:5。\n\n以参考图像作为基础产品参考。在所有九个面板中，保持与参考完全相同的产品、包装设计、品牌、材料、颜色、比例和整体识别。产品必须在每一帧都清晰可辨。标签、标志和比例必须保持完全一致。\n\n该故事板是高端品牌组合的模拟展示，重点在于形式、构图、材质和视觉节奏，而非现实主义或生活方式叙事。整体外观应具有策展感、编辑感和设计感。');
    } else {
      setTitle('');
      setDescription('');
    }
  }, [initialData, isOpen]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-fade-in" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[1000px] h-[700px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl z-[101] flex overflow-hidden outline-none border border-slate-200 dark:border-zinc-800 animate-scale-in">
          
          {/* Header */}
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex w-full h-full">
            {/* Left Panel: Metadata & Image */}
            <div className="w-[360px] bg-slate-50 dark:bg-zinc-900/50 border-r border-slate-200 dark:border-zinc-800 p-6 flex flex-col gap-6 overflow-y-auto">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
                  {initialData ? '编辑创意' : '新增创意到库'}
                </h2>
                
                {/* Image Upload/Preview */}
                <div className="aspect-[4/3] bg-white dark:bg-zinc-800 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group relative overflow-hidden">
                  {initialData ? (
                    <img src={initialData.image} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 mb-2 transition-colors" />
                      <span className="text-xs text-slate-500">上传图片</span>
                    </>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">标题 <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="创意标题"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">分类</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '人物', icon: User },
                      { label: '场景', icon: MapPin },
                      { label: '产品', icon: Box },
                      { label: '艺术', icon: Palette },
                      { label: '工具', icon: Wrench },
                      { label: '其他', icon: MoreHorizontal },
                    ].map((cat) => (
                      <button key={cat.label} className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-colors">
                        <cat.icon size={12} className="text-slate-400" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">作者</label>
                  <input 
                    type="text" 
                    defaultValue={initialData?.author || '@ 作者名称'}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">模式</label>
                  <div className="flex bg-slate-200 dark:bg-zinc-800 p-1 rounded-lg">
                    <button className="flex-1 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded shadow-sm">Standard</button>
                    <button className="flex-1 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">BP</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">宽高比</label>
                    <select className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm appearance-none">
                      <option>1:1</option>
                      <option>16:9</option>
                      <option>9:16</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">分辨率</label>
                    <select className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm appearance-none">
                      <option>2K</option>
                      <option>4K</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Prompt Editing */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="h-14 border-b border-slate-200 dark:border-zinc-800 flex items-center px-6">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  提示词编辑
                </div>
              </div>
              
              <div className="flex-1 p-6">
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="输入详细的提示词描述..."
                  className="w-full h-full resize-none bg-slate-50 dark:bg-zinc-800/30 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="p-6 pt-0 flex justify-end gap-3">
                <button 
                  onClick={onClose}
                  className="px-6 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onSave?.({
                      ...initialData,
                      title: title.trim() || '未命名创意',
                      author: initialData?.author || '@hoodax',
                      image: initialData?.image || 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=1000&auto=format&fit=crop',
                      date: initialData?.date || '刚刚',
                      likes: initialData?.likes || 0,
                    });
                    onClose();
                  }}
                  className="px-8 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-500/20 transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  保存创意
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
