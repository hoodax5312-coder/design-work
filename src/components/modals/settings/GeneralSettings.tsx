import { Check, Palette, PanelLeft, Settings2, Sun, Moon, Monitor } from '@/lib/remixIconShim';
import {
  FONT_PRESETS,
  THEME_PRESETS,
  useUIStore,
  type AppLanguage,
  type FontPreset,
  type NavigationPosition,
  type SidebarCollapseMode,
  type SidebarStyle,
  type ThemePreset,
} from '../../../stores/useUIStore';
import { cn } from '../../../lib/utils';
import { Select } from '../../ui';

const themeModeOptions = [
  { value: 'light', label: '浅色模式', icon: Sun },
  { value: 'dark', label: '暗黑模式', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const;

const additionalThemeOptions: Array<Exclude<ThemePreset, 'nature'>> = ['brutalist', 'claude'];

const ThemeStylePreview = ({ preset }: { preset: Exclude<ThemePreset, 'nature'> }) => {
  const preview = THEME_PRESETS[preset].preview;
  const brutalist = preset === 'brutalist';

  return (
    <div className="h-full p-3" style={{ background: preview.background }} aria-hidden="true">
      <div
        className="flex h-full overflow-hidden"
        style={{
          background: preview.card,
          borderColor: preview.border,
          borderRadius: preview.radius,
          borderStyle: 'solid',
          borderWidth: preview.borderWidth,
          boxShadow: brutalist ? '5px 5px 0 #000000' : preview.shadow,
        }}
      >
        <div
          className="w-12 shrink-0 border-r p-2"
          style={{ borderColor: preview.border, borderRightWidth: preview.borderWidth }}
        >
          <div className="mb-3 h-3 w-3" style={{ background: preview.primary, borderRadius: preview.radius }} />
          <div className="mb-1.5 h-1.5 w-6" style={{ background: preview.muted, borderRadius: preview.radius }} />
          <div className="h-1.5 w-5 opacity-55" style={{ background: preview.primary, borderRadius: preview.radius }} />
        </div>
        <div className="min-w-0 flex-1 p-3">
          <div className="mb-2 h-2 w-16" style={{ background: preview.primary, borderRadius: preview.radius }} />
          <div className="grid grid-cols-2 gap-2">
            <div
              className="h-8 border"
              style={{ background: preview.muted, borderColor: preview.border, borderRadius: preview.radius, borderWidth: preview.borderWidth }}
            />
            <div
              className="h-8 border"
              style={{ background: preview.card, borderColor: preview.border, borderRadius: preview.radius, borderWidth: preview.borderWidth }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ThemeCardOverlay = ({
  label,
  icon: Icon,
  selected,
}: {
  label: string;
  icon?: React.ElementType;
  selected: boolean;
}) => (
  <div className="absolute inset-x-0 bottom-0 z-10 flex h-16 items-end justify-between gap-2 bg-gradient-to-b from-transparent via-black/20 to-black/50 px-3 pb-2 text-white">
    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
      {Icon && <Icon size={16} aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </span>
    <span className={cn(
      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-[opacity,scale] duration-150',
      selected
        ? 'scale-100 border-white bg-white text-black opacity-100'
        : 'scale-75 border-transparent opacity-0',
    )}>
      <Check size={12} aria-hidden="true" />
    </span>
  </div>
);

const ThemeModePreview = ({ mode }: { mode: (typeof themeModeOptions)[number]['value'] }) => {
  const isDark = mode === 'dark';

  if (mode === 'system') {
    return (
      <div className="grid h-full grid-cols-2 overflow-hidden" aria-hidden="true">
        <div className="bg-[#fafafa] p-3 pr-1.5">
          <div className="flex h-full overflow-hidden rounded-[5px] border border-black/10 bg-white shadow-sm">
            <div className="w-6 shrink-0 border-r border-black/10 bg-[#fafafa] p-1.5">
              <div className="h-2 w-2 rounded-sm bg-black" />
            </div>
            <div className="min-w-0 flex-1 space-y-2 p-2">
              <div className="h-1.5 w-8 rounded-full bg-black" />
              <div className="h-5 rounded border border-black/10 bg-[#fafafa]" />
              <div className="h-1.5 w-10 rounded-full bg-black/15" />
            </div>
          </div>
        </div>
        <div className="bg-black p-3 pl-1.5">
          <div className="flex h-full overflow-hidden rounded-[5px] border border-white/15 bg-[#111] shadow-sm">
            <div className="w-6 shrink-0 border-r border-white/15 bg-[#0a0a0a] p-1.5">
              <div className="h-2 w-2 rounded-sm bg-white" />
            </div>
            <div className="min-w-0 flex-1 space-y-2 p-2">
              <div className="h-1.5 w-8 rounded-full bg-white" />
              <div className="h-5 rounded border border-white/15 bg-[#1f1f1f]" />
              <div className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full p-3', isDark ? 'bg-black' : 'bg-[#fafafa]')} aria-hidden="true">
      <div className={cn(
        'flex h-full overflow-hidden rounded-[5px] border shadow-sm',
        isDark ? 'border-white/15 bg-[#111]' : 'border-black/10 bg-white',
      )}>
        <div className={cn(
          'w-12 shrink-0 border-r p-2',
          isDark ? 'border-white/15 bg-[#0a0a0a]' : 'border-black/10 bg-[#fafafa]',
        )}>
          <div className={cn('mb-3 h-3 w-3 rounded-sm', isDark ? 'bg-white' : 'bg-black')} />
          <div className={cn('mb-1.5 h-1.5 w-6 rounded-full', isDark ? 'bg-white/35' : 'bg-black/25')} />
          <div className={cn('h-1.5 w-5 rounded-full', isDark ? 'bg-white/20' : 'bg-black/10')} />
        </div>
        <div className="min-w-0 flex-1 p-3">
          <div className={cn('mb-2 h-2 w-16 rounded-full', isDark ? 'bg-white' : 'bg-black')} />
          <div className="grid grid-cols-2 gap-2">
            <div className={cn('h-8 rounded border', isDark ? 'border-white/15 bg-[#1f1f1f]' : 'border-black/10 bg-[#fafafa]')} />
            <div className={cn('h-8 rounded border', isDark ? 'border-white/15 bg-[#1f1f1f]' : 'border-black/10 bg-[#fafafa]')} />
          </div>
        </div>
      </div>
    </div>
  );
};

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
    themePreset,
    fontPreset,
    themeMode,
    sidebarStyle,
    sidebarCollapseMode,
    navigationPosition,
    language,
    setFontPreset,
    setThemePreset,
    setThemeMode,
    setSidebarStyle,
    setSidebarCollapseMode,
    setNavigationPosition,
    setLanguage,
  } = useUIStore();

  return (
    <div className="w-full space-y-7 pb-2">
      <SettingsModule icon={Palette} title="主题设置">
        <div className="space-y-4">
          <SettingsGroup title="主题模式">
            <div className="grid grid-cols-3 gap-3" role="tablist" aria-label="主题模式">
              {themeModeOptions.map(({ value, label, icon: Icon }) => {
                const selected = themePreset === 'nature' && themeMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setThemePreset('nature');
                      setThemeMode(value);
                    }}
                    className={cn(
                      'group relative h-[136px] overflow-hidden rounded-[var(--surface-card-radius)] border bg-[var(--surface-card-bg)] text-left shadow-[var(--surface-card-shadow)] transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.96]',
                      selected
                        ? 'border-primary shadow-[var(--surface-card-hover-shadow)]'
                        : 'border-[var(--surface-card-border)] hover:border-foreground/30 hover:shadow-[var(--surface-card-hover-shadow)]',
                    )}
                  >
                    <div className="h-full">
                      <ThemeModePreview mode={value} />
                    </div>
                    <ThemeCardOverlay label={label} icon={Icon} selected={selected} />
                  </button>
                );
              })}
            </div>
            <div className="space-y-3 border-t border-[var(--surface-panel-border)] pt-4">
              <h4 className="text-sm font-semibold text-foreground">更多风格</h4>
              <div className="grid grid-cols-3 gap-3" role="tablist" aria-label="更多主题风格">
                {additionalThemeOptions.map((preset) => {
                  const selected = themePreset === preset;
                  const { label } = THEME_PRESETS[preset];
                  return (
                    <button
                      key={preset}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setThemePreset(preset)}
                      className={cn(
                        'group relative h-[136px] overflow-hidden rounded-[var(--surface-card-radius)] border bg-[var(--surface-card-bg)] text-left shadow-[var(--surface-card-shadow)] transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.96]',
                        selected
                          ? 'border-primary shadow-[var(--surface-card-hover-shadow)]'
                          : 'border-[var(--surface-card-border)] hover:border-foreground/30 hover:shadow-[var(--surface-card-hover-shadow)]',
                      )}
                    >
                      <div className="h-full">
                        <ThemeStylePreview preset={preset} />
                      </div>
                      <ThemeCardOverlay label={label} selected={selected} />
                    </button>
                  );
                })}
                <div aria-hidden="true" />
              </div>
            </div>
          </SettingsGroup>
        </div>
      </SettingsModule>

      <SettingsModule icon={PanelLeft} title="导航栏设置">
        <SettingsGroup>
          <SettingRow title="导航栏位置">
            <SegmentedControl<NavigationPosition>
              label="导航栏位置"
              value={navigationPosition}
              onChange={setNavigationPosition}
              themeAction
              options={[
                { value: 'left', label: '左侧' },
                { value: 'top', label: '顶部' },
                { value: 'right', label: '右侧' },
              ]}
            />
          </SettingRow>
          <SettingRow title="导航栏样式">
            <SegmentedControl<SidebarStyle>
              label="导航栏样式"
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
          <SettingRow title="导航栏收起">
            <SegmentedControl<SidebarCollapseMode>
              label="导航栏收起"
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
