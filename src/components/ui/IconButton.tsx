import { forwardRef, type ButtonHTMLAttributes, type ElementType } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-full transition-all duration-200 focus:outline-none disabled:pointer-events-none disabled:opacity-50 relative group',
  {
    variants: {
      variant: {
        default: 'text-zinc-400 hover:text-white hover:bg-white/10',
        active: 'bg-accent-cyan text-white shadow-lg shadow-accent-cyan/20',
        ghost: 'text-zinc-400 hover:text-white',
        subtle: 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10',
        accent: 'bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30',
      },
      size: {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  icon: ElementType;
  iconSize?: number;
  label?: string;
  showTooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant,
      size,
      icon: Icon,
      iconSize = 20,
      label,
      showTooltip = true,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(iconButtonVariants({ variant, size }), className)}
        title={label}
        {...props}
      >
        <Icon size={iconSize} strokeWidth={variant === 'active' ? 2.5 : 2} />
        {showTooltip && label && (
          <span className="absolute left-full ml-2 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {label}
          </span>
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export { iconButtonVariants };
