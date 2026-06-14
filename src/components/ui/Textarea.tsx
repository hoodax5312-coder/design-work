import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const textareaVariants = cva(
  'w-full transition-all duration-200 focus:outline-none disabled:pointer-events-none disabled:opacity-50 resize-none',
  {
    variants: {
      variant: {
        default:
          'bg-zinc-900 text-white border border-white/10 rounded-lg px-4 py-3 placeholder:text-zinc-500 focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan',
        ghost:
          'bg-transparent text-white border-none placeholder:text-zinc-500 focus:ring-0',
        filled:
          'bg-zinc-800 text-white border-none rounded-lg px-4 py-3 placeholder:text-zinc-500 focus:ring-2 focus:ring-accent-cyan',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, label, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            textareaVariants({ variant }),
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-xs text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { textareaVariants };
