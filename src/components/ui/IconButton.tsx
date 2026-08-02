import { forwardRef, type ButtonHTMLAttributes, type ElementType } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const iconButtonVariants = cva(
  'relative inline-flex items-center justify-center rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group',
  {
    variants: {
      variant: {
        default: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        active: 'bg-primary text-primary-foreground',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        subtle: 'border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        accent: 'bg-primary/15 text-foreground hover:bg-primary/25',
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
          <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
            {label}
          </span>
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export { iconButtonVariants };
