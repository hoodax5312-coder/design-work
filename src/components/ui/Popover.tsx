import { createContext, forwardRef, useContext, useState, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { popVariants } from '../motion/tokens';

const OpenContext = createContext(false);

const Popover = ({ open: openProp, defaultOpen = false, onOpenChange, children, ...props }: PopoverPrimitive.PopoverProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
      <OpenContext.Provider value={open}>{children}</OpenContext.Provider>
    </PopoverPrimitive.Root>
  );
};

const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;

/**
 * 内容通过 framer-motion 进出场。带 `nokey` 类，避免画布把浮层内的按键当作节点操作。
 */
const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, sideOffset = 8, collisionPadding = 8, children, style, ...props }, ref) => {
  const open = useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <PopoverPrimitive.Portal forceMount>
          <PopoverPrimitive.Content ref={ref} forceMount asChild sideOffset={sideOffset} collisionPadding={collisionPadding} {...props}>
            <motion.div
              variants={popVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                'nokey nowheel z-[100] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-[0_12px_32px_rgba(0,0,0,0.16)] outline-none',
                className,
              )}
              style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)', ...style }}
            >
              {children}
            </motion.div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </AnimatePresence>
  );
});
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverAnchor, PopoverClose, PopoverContent };
