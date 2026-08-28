import { type ButtonHTMLAttributes } from 'react';
import { Sparkles } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { Button } from '../ui';

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
    <Button
      type="button"
      variant="primary"
      size="lg"
      disabled={disabled || loading}
      loading={loading}
      className={cn('mt-auto w-full font-medium', className)}
      {...props}
    >
      {!loading && (
        <Icon size={18} />
      )}
      {children}
    </Button>
  );
}
