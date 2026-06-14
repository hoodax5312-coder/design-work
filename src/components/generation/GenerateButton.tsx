import { type ButtonHTMLAttributes } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GenerateButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: React.ElementType;
}

export function GenerateButton({
  loading = false,
  icon: Icon = Sparkles,
  children = '立即生成',
  className,
  disabled,
  ...props
}: GenerateButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'mt-auto flex items-center justify-center gap-2 w-full py-2.5 bg-[#551db0] hover:bg-[#451690] text-white rounded-lg transition-colors font-medium',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <Icon size={18} />
      )}
      {children}
    </button>
  );
}
