import { type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button, Textarea } from '../ui';

interface PromptInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  height?: number;
  actions?: ReactNode;
}

export function PromptInput({
  label = '提示词',
  height = 160,
  className,
  actions,
  ...props
}: PromptInputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <Textarea className={cn('resize-none', className)} style={{ height }} {...props} />
        {actions && (
          <div className="absolute bottom-2 left-2 flex gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

interface PromptActionButtonProps {
  icon: React.ElementType;
  children: ReactNode;
  onClick?: () => void;
}

export function PromptActionButton({
  icon: Icon,
  children,
  onClick,
}: PromptActionButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onClick}
      className="h-7 px-2 text-xs"
    >
      <Icon size={12} />
      {children}
    </Button>
  );
}
