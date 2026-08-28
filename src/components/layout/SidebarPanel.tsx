import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, PanelType } from '../../stores/useUIStore';
import { X } from '@/lib/remixIconShim';
import { Button, Card, Skeleton } from '../ui';

const PanelContent = ({ type }: { type: PanelType }) => {
  switch (type) {
    case 'assets':
      return (
        <div className="p-4 grid grid-cols-2 gap-2">
          {/* Mock Assets */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      );
    case 'workflow':
      return (
        <div className="p-4 flex flex-col gap-2">
          {/* Mock Workflows */}
          {['项目 Alpha', '营销活动', '社交媒体'].map((name) => (
            <Card key={name} padding="sm" className="cursor-pointer transition-[border-color] hover:border-foreground/20"><div className="text-sm font-medium">{name}</div><div className="text-xs text-muted-foreground">上次编辑 2小时前</div></Card>
          ))}
        </div>
      );
    case 'history':
      return (
        <div className="p-4 space-y-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">今天</div>
          <div className="space-y-2">
            <div className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent p-2 transition-[border-color] hover:border-border">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm text-foreground">添加了视频节点</span>
            </div>
            <div className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent p-2 transition-[border-color] hover:border-border">
              <div className="h-2 w-2 rounded-full bg-primary/55" />
              <span className="text-sm text-foreground">连接了节点</span>
            </div>
          </div>
        </div>
      );
    default:
      return <div className="p-4 text-muted-foreground">内容：{type}</div>;
  }
};

export const SidebarPanel = () => {
  const { activePanel, setActivePanel } = useUIStore();

  return (
    <AnimatePresence>
      {activePanel && (
        <motion.div
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-16 top-0 z-40 w-[320px] border-r border-border bg-card text-card-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold capitalize">{activePanel}</h2>
            <Button variant="ghost" size="iconSm"
              onClick={() => setActivePanel(null)}
            >
              <X size={16} />
            </Button>
          </div>
          <div className="h-[calc(100vh-64px)] overflow-y-auto">
            <PanelContent type={activePanel} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
