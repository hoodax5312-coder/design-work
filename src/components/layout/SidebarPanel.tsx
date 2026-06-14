import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, PanelType } from '../../stores/useUIStore';
import { X } from 'lucide-react';

const PanelContent = ({ type }: { type: PanelType }) => {
  switch (type) {
    case 'assets':
      return (
        <div className="p-4 grid grid-cols-2 gap-2">
          {/* Mock Assets */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square bg-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      );
    case 'workflow':
      return (
        <div className="p-4 flex flex-col gap-2">
          {/* Mock Workflows */}
          {['项目 Alpha', '营销活动', '社交媒体'].map((name) => (
            <div key={name} className="p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors">
              <div className="text-sm font-medium text-white">{name}</div>
              <div className="text-xs text-zinc-500">上次编辑 2小时前</div>
            </div>
          ))}
        </div>
      );
    case 'history':
      return (
        <div className="p-4 space-y-4">
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">今天</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
              <div className="w-2 h-2 rounded-full bg-accent-cyan" />
              <span className="text-sm text-zinc-300">添加了视频节点</span>
            </div>
            <div className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
              <div className="w-2 h-2 rounded-full bg-accent-purple" />
              <span className="text-sm text-zinc-300">连接了节点</span>
            </div>
          </div>
        </div>
      );
    default:
      return <div className="p-4 text-zinc-500">内容：{type}</div>;
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
          className="fixed left-16 top-0 bottom-0 w-[320px] glass-panel z-40 border-l-0 rounded-l-none"
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white capitalize">{activePanel}</h2>
            <button 
              onClick={() => setActivePanel(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="h-[calc(100vh-64px)] overflow-y-auto">
            <PanelContent type={activePanel} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
