import { useState, useEffect } from 'react';
import { Upload, Save, User, MapPin, Box, Palette, Wrench, MoreHorizontal } from '@/lib/remixIconShim';
import { Button, Dialog, DialogContent, DialogTitle, Input, Select, Tabs, TabsList, TabsTrigger, Textarea } from '../ui';

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex h-[min(700px,calc(100vh-2rem))] max-w-[1000px] gap-0 overflow-hidden p-0">
          <div className="flex w-full h-full">
            {/* Left Panel: Metadata & Image */}
            <div className="flex w-[360px] flex-col gap-6 overflow-y-auto border-r border-border bg-muted/35 p-6">
              <div>
                <DialogTitle className="mb-4 text-lg">
                  {initialData ? '编辑创意' : '新增创意到库'}
                </DialogTitle>
                
                {/* Image Upload/Preview */}
                <div className="group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-card transition-colors hover:border-foreground/30">
                  {initialData ? (
                    <img src={initialData.image} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground transition-colors group-hover:text-foreground" />
                      <span className="text-xs text-muted-foreground">上传图片</span>
                    </>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <Input label="标题 *"
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="创意标题"
                    className="text-sm"
                  />

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">分类</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '人物', icon: User },
                      { label: '场景', icon: MapPin },
                      { label: '产品', icon: Box },
                      { label: '艺术', icon: Palette },
                      { label: '工具', icon: Wrench },
                      { label: '其他', icon: MoreHorizontal },
                    ].map((cat) => (
                      <Button key={cat.label} variant="secondary" size="sm" className="gap-1 px-2 text-xs"><cat.icon size={12} />{cat.label}</Button>
                    ))}
                  </div>
                </div>

                <Input label="作者"
                    type="text" 
                    defaultValue={initialData?.author || '@ 作者名称'}
                    className="text-sm"
                  />

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">模式</label>
                  <Tabs defaultValue="standard"><TabsList className="w-full"><TabsTrigger value="standard" className="flex-1 text-xs">Standard</TabsTrigger><TabsTrigger value="bp" className="flex-1 text-xs">BP</TabsTrigger></TabsList></Tabs>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select label="宽高比" defaultValue="1:1" options={['1:1','16:9','9:16'].map((value) => ({ value, label: value }))} />
                  <Select label="分辨率" defaultValue="2K" options={['2K','4K'].map((value) => ({ value, label: value }))} />
                </div>
              </div>
            </div>

            {/* Right Panel: Prompt Editing */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex h-14 items-center border-b border-border px-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  提示词编辑
                </div>
              </div>
              
              <div className="flex-1 p-6">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="输入详细的提示词描述..."
                  className="h-full text-sm leading-relaxed"
                />
              </div>

              <div className="p-6 pt-0 flex justify-end gap-3">
                <Button variant="ghost"
                  onClick={onClose}
                >
                  取消
                </Button>
                <Button variant="primary"
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
                >
                  <Save size={16} />
                  保存创意
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
    </Dialog>
  );
};
