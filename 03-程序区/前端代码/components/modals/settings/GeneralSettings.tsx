import { Monitor } from 'lucide-react';
import { useUIStore } from '../../../stores/useUIStore';
import { Tabs, TabsList, TabsTrigger } from '../../ui/Tabs';
import { Card, CardDescription, CardHeader, CardTitle } from '../../ui/Card';

export function GeneralSettings() {
  const { theme, toggleTheme } = useUIStore();

  return (
    <div className="space-y-5">
      {/* Interface Preferences */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-[12px] font-semibold text-slate-900 dark:text-white">
          <Monitor size={16} /> 界面偏好
        </h4>
        <Card
          variant="solid"
          padding="none"
          className="border-0 bg-[#fafaf8] shadow-none dark:bg-white/[0.025]"
        >
          <CardHeader className="w-full justify-between border-b-0 px-4 py-4">
            <div>
              <CardTitle>外观主题</CardTitle>
              <CardDescription className="mt-1 text-xs">切换系统的明亮/暗黑模式</CardDescription>
            </div>
            <Tabs
              value={theme}
              onValueChange={(value) => value !== theme && toggleTheme()}
              className="ml-auto shrink-0"
            >
              <TabsList>
                <TabsTrigger value="light">明亮</TabsTrigger>
                <TabsTrigger value="dark">暗黑</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
