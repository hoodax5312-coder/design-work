import { useRef, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  MoreHorizontal,
  Folder,
  User,
  Image as ImageIcon,
  Box,
  Palette,
  Wrench,
  FileText,
  Star,
  Filter
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { InspirationModal } from './InspirationModal';
import { InspirationDetailPanel } from './InspirationDetailPanel';

const CATEGORIES = [
  { id: 'all', label: '全部', icon: Folder },
  { id: 'people', label: '人物', icon: User },
  { id: 'scenes', label: '场景', icon: ImageIcon },
  { id: 'products', label: '产品', icon: Box },
  { id: 'art', label: '艺术', icon: Palette },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'others', label: '其他', icon: FileText },
];

export const Inspiration = () => {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const visibleCards = showFavorites ? cards.filter((card) => card.likes > 2) : cards;

  const handleCardClick = (card: any) => {
    setSelectedCard(card);
    // setIsModalOpen(true); // Removed modal open, now selects for detail panel
  };

  const handleNewClick = () => {
    setSelectedCard(null);
    setIsModalOpen(true);
  };

  const exportCards = () => {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mboard-inspirations-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importCards = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Invalid inspiration file');
    setCards(imported);
  };

  const saveCard = (card: any) => {
    setCards((current) => {
      if (card.id) {
        return current.map((item) => item.id === card.id ? { ...item, ...card } : item);
      }
      return [{ ...card, id: Date.now() }, ...current];
    });
  };

  return (
    <div className="flex w-full h-full bg-white dark:bg-black transition-colors">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          importCards(event.target.files?.[0]).catch(() => window.alert('导入失败，请选择有效的创意库 JSON 文件。'));
          event.target.value = '';
        }}
      />
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
        
        {/* Top Toolbar */}
        <div className="h-14 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">创意库</h2>
            <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />
            <div className="flex items-center gap-1">
               <button className="px-3 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">本地创意 {cards.length}</button>
               <button className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">画布</button>
            </div>
            <button
              onClick={() => setShowFavorites((value) => !value)}
              className={cn(
                "flex items-center gap-2 text-xs font-medium cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-500/10 px-2 py-1 rounded transition-colors",
                showFavorites ? "text-amber-600 bg-amber-50 dark:bg-amber-500/10" : "text-amber-500"
              )}
            >
               <Star size={14} className="fill-amber-500" />
               收藏创意
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-slate-600 dark:text-slate-300"
            >
              <Download size={14} /> 导入
            </button>
            <button
              onClick={exportCards}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-slate-600 dark:text-slate-300"
            >
              <Upload size={14} /> 导出
            </button>
            <button 
              onClick={handleNewClick}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm shadow-indigo-500/20"
            >
              <Plus size={14} /> 新增
            </button>
          </div>
        </div>

        {/* Sub Header & Filters */}
        <div className="h-12 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white dark:bg-zinc-900 flex-shrink-0">
           <div className="flex items-center gap-3 flex-1">
             <div className="relative w-64">
               <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="搜索标题..." 
                 className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
               />
             </div>
             <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
               按时间 <Filter size={12} />
             </button>
           </div>
           <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg">
             <button
               onClick={() => setShowFavorites(false)}
               className={cn("px-3 py-1 text-xs font-medium rounded", !showFavorites ? "bg-white dark:bg-zinc-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
             >
               全部
             </button>
             <button
               onClick={() => setShowFavorites(true)}
               className={cn("px-3 py-1 text-xs font-medium rounded", showFavorites ? "bg-white dark:bg-zinc-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
             >
               收藏
             </button>
             <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">BP</button>
             <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">工作流</button>
           </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar Categories */}
          <div className="w-48 border-r border-slate-200 dark:border-zinc-800 p-3 overflow-y-auto bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-medium text-slate-500">分类</span>
              <MoreHorizontal size={14} className="text-slate-400 cursor-pointer" />
            </div>
            <div className="space-y-0.5">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const count = cat.id === 'all'
                  ? cards.length
                  : cards.filter((card) => card.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors group",
                      activeCategory === cat.id 
                        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={cn(activeCategory === cat.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
                      {cat.label}
                    </div>
                    {count > 0 && (
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full",
                        activeCategory === cat.id ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-zinc-800 text-slate-400"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Grid Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-white dark:bg-zinc-900">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleCards.map(card => (
                <div 
                    key={card.id} 
                    onClick={() => handleCardClick(card)}
                    className={cn(
                      "group relative bg-white dark:bg-zinc-800 rounded-xl border overflow-hidden hover:shadow-md transition-all cursor-pointer",
                      selectedCard?.id === card.id 
                        ? "border-indigo-500 ring-1 ring-indigo-500/20" 
                        : "border-slate-200 dark:border-zinc-700 hover:border-indigo-500/50"
                    )}
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-zinc-900">
                      <img src={card.image} alt={card.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      
                      {/* Overlay Badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                       <div className="px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-white flex items-center gap-1">
                         <Folder size={10} />
                         2
                       </div>
                    </div>
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button className="p-1.5 bg-white/90 dark:bg-zinc-800/90 rounded-lg hover:text-indigo-600 shadow-sm">
                         <MoreHorizontal size={14} />
                       </button>
                    </div>
                  </div>
                  
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-slate-800 dark:text-white line-clamp-1 mb-1">{card.title}</h3>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400" />
                        <span className="truncate max-w-[80px]">{card.author}</span>
                      </div>
                      <span>{card.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!visibleCards.length && (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <Folder size={30} className="mb-4 text-slate-300" />
                <div className="text-sm font-medium text-slate-800 dark:text-white">素材库为空</div>
                <p className="mt-2 text-xs text-slate-500">点击“新增”创建素材，或导入已有 JSON 文件。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar (Detail Panel) */}
      <InspirationDetailPanel 
        item={selectedCard} 
        onClose={() => setSelectedCard(null)}
      />

      {/* Modal - Still used for 'New' action */}
      <InspirationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={selectedCard} 
        onSave={saveCard}
      />
    </div>
  );
};
