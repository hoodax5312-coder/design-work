import { Check, Palette, PanelLeft, Settings2, Sun, Moon, Monitor } from '@/lib/remixIconShim';
import {
  FONT_PRESETS,
  useUIStore,
  type AppLanguage,
  type FontPreset,
  type SidebarCollapseMode,
  type SidebarStyle,
} from '../../../stores/useUIStore';
import { cn } from '../../../lib/utils';
import { Select } from '../../ui';

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onChange,
  themeAction = false,
}: {
  label: string;
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
  themeAction?: boolean;
}) => (
  <div role="tablist" aria-label={label} className="grid h-8 w-full grid-flow-col auto-cols-fr gap-0.5 rounded-md bg-[var(--neutral-surface-subtle)] p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="tab"
        aria-selected={value === option.value}
        disabled={option.disabled}
        title={option.disabled ? '英文界面将在完整国际化后开放' : undefined}
        onClick={() => onChange(option.value)}
        className={cn(
          'min-w-0 rounded-[4px] px-2 text-xs font-medium text-muted-foreground transition-colors',
          value === option.value && (themeAction
            ? 'bg-[var(--action-secondary-bg)] text-[var(--action-secondary-foreground)] shadow-sm'
            : 'bg-accent text-accent-foreground shadow-sm'),
          !option.disabled && value !== option.value && (themeAction
            ? 'hover:bg-primary hover:text-white'
            : 'hover:text-foreground'),
          option.disabled && 'cursor-not-allowed opacity-40',
        )}
        style={value === option.value && !themeAction ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : undefined}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const SettingRow = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex min-h-9 items-center justify-between gap-6">
    <h3 className="text-sm font-medium text-foreground">{title}</h3>
    <div className="w-[280px] shrink-0">{children}</div>
  </div>
);

const SettingsModule = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon size={16} aria-hidden="true" />
      <h2>{title}</h2>
    </div>
    {children}
  </section>
);

const SettingsGroup = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="space-y-4 rounded-[var(--surface-panel-radius)] border-[var(--surface-panel-border-width)] border-[var(--surface-panel-border)] bg-[var(--surface-panel-bg)] p-4 text-[var(--surface-panel-foreground)] shadow-[var(--surface-panel-shadow)]">
    {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
    {children}
  </div>
);

export function GeneralSettings() {
  const {
    fontPreset,
    themeMode,
    sidebarStyle,
    sidebarCollapseMode,
    language,
    setFontPreset,
    setThemeMode,
    setSidebarStyle,
    setSidebarCollapseMode,
    setLanguage,
  } = useUIStore();

  return (
    <div className="w-full space-y-7 pb-2">
      <SettingsModule icon={Palette} title="主题设置">
        <div className="space-y-4">
          <SettingsGroup title="主题模式">
            <div className="grid grid-cols-3 gap-3" role="tablist" aria-label="主题模式">
              {([
                ['light', '浅色', Sun],
                ['dark', '暗色', Moon],
                ['system', '跟随系统', Monitor],
              ] as const).map(([value, label, Icon]) => {
                const selected = themeMode === value;
                return <button key={value} type="button" role="tab" aria-selected={selected} onClick={() => setThemeMode(value)} className={cn('flex h-20 flex-col items-center justify-center gap-2 rounded-[var(--surface-panel-radius)] border-[var(--surface-panel-border-width)] px-3 text-xs font-medium transition-colors', selected ? 'border-primary bg-[var(--action-secondary-bg)] text-primary' : 'border-[var(--surface-panel-border)] text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon size={18} /><span>{label}</span>{selected && <Check size={12} />}</button>;
              })}
            </div>
          </SettingsGroup>
        </div>
      </SettingsModule>

      <SettingsModule icon={PanelLeft} title="导航栏设置">
        <SettingsGroup>
          <SettingRow title="侧栏样式">
            <SegmentedControl<SidebarStyle>
              label="侧栏样式"
              value={sidebarStyle}
              onChange={setSidebarStyle}
              themeAction
              options={[
                { value: 'embedded', label: '内嵌' },
                { value: 'standard', label: '普通' },
                { value: 'floating', label: '浮动' },
              ]}
            />
          </SettingRow>
          <SettingRow title="侧栏收起方式">
            <SegmentedControl<SidebarCollapseMode>
              label="侧栏收起方式"
              value={sidebarCollapseMode}
              onChange={setSidebarCollapseMode}
              themeAction
              options={[
                { value: 'icons', label: '保留图标' },
                { value: 'hidden', label: '完全隐藏' },
              ]}
            />
          </SettingRow>
        </SettingsGroup>
      </SettingsModule>

      <SettingsModule icon={Settings2} title="其他设置">
        <SettingsGroup>
          <SettingRow title="字体">
            <Select
              aria-label="字体"
              value={fontPreset}
              onChange={(event) => setFontPreset(event.target.value as FontPreset)}
              options={(Object.entries(FONT_PRESETS) as Array<[FontPreset, (typeof FONT_PRESETS)[FontPreset]]>)
                .map(([value, preset]) => ({ value, label: preset.label }))}
              className="h-9"
            />
          </SettingRow>
          <SettingRow title="语言">
            <div className="space-y-1.5">
            <SegmentedControl<AppLanguage>
              label="语言"
              value={language}
              onChange={setLanguage}
              themeAction
                options={[
                  { value: 'en-US', label: 'English', disabled: true },
                  { value: 'zh-CN', label: '中文' },
                ]}
              />
              <p className="text-[11px] text-muted-foreground">英文界面将在完成全量文案适配后开放。</p>
            </div>
          </SettingRow>
        </SettingsGroup>
      </SettingsModule>
    </div>
  );
}
