// Source: https://ui.shadcn.com/r/styles/new-york/input.json (MIT).
// Project adaptation: legacy size/variant classes only; labels compose with Label.
import * as React from "react"

import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva('', {
  variants: {
    variant: { default: '', ghost: 'border-transparent bg-transparent shadow-none', filled: 'border-transparent bg-muted' },
    inputSize: { sm: 'h-8 text-xs', md: 'h-10 text-sm', lg: 'h-12 text-base' },
  },
});
export interface InputProps extends Omit<React.ComponentProps<'input'>, 'size'> {
  inputSize?: 'sm' | 'md' | 'lg';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'filled';
}
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, size, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          inputVariants({ variant, inputSize: size ?? inputSize }),
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }
