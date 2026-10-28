import { createContext, forwardRef, useContext, useState, type ComponentPropsWithoutRef, type ElementRef, type ElementType, type HTMLAttributes } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { popVariants } from '../motion/tokens';

const OpenContext = createContext(false);

const DropdownMenu = ({ open: openProp, defaultOpen = false, onOpenChange, children, ...props }: DropdownMenuPrimitive.DropdownMenuProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
      <OpenContext.Provider value={open}>{children}</OpenContext.Provider>
    </DropdownMenuPrimitive.Root>
  );
};

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const itemClassName = 'relative flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-xs outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

/**
 * 内容通过 framer-motion 进出场。带 `nokey` 类，避免画布把菜单内的按键当作节点操作。
 */
const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, collisionPadding = 8, children, style, ...props }, ref) => {
  const open = useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <DropdownMenuPrimitive.Portal forceMount>
          <DropdownMenuPrimitive.Content ref={ref} forceMount asChild sideOffset={sideOffset} collisionPadding={collisionPadding} {...props}>
            <motion.div
              variants={popVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                'nokey nowheel z-[100] min-w-[168px] overflow-y-auto overflow-x-hidden rounded-lg border border-[color:var(--popover-border)] bg-popover p-1 text-popover-foreground [box-shadow:var(--popover-shadow)] outline-none',
                'max-h-[var(--radix-dropdown-menu-content-available-height)]',
                className,
              )}
              style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)', ...style }}
            >
              {children}
            </motion.div>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      )}
    </AnimatePresence>
  );
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  icon?: ElementType;
  shortcut?: string;
  destructive?: boolean;
}

const DropdownMenuItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Item>, DropdownMenuItemProps>(
  ({ className, icon: Icon, shortcut, destructive, children, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(itemClassName, destructive && 'text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive', className)}
      {...props}
    >
      {Icon && <Icon size={14} className="shrink-0 opacity-80" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </DropdownMenuPrimitive.Item>
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem ref={ref} className={cn(itemClassName, 'pr-7', className)} {...props}>
    <span className="min-w-0 flex-1 truncate">{children}</span>
    <DropdownMenuPrimitive.ItemIndicator className="absolute right-2 grid place-items-center">
      <Check size={13} />
    </DropdownMenuPrimitive.ItemIndicator>
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label ref={ref} className={cn('px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground', className)} {...props} />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuShortcut = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('ml-auto pl-3 text-[11px] tracking-wide text-muted-foreground', className)} {...props} />
);

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuSubTrigger = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { icon?: ElementType }
>(({ className, icon: Icon, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger ref={ref} className={cn(itemClassName, 'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground', className)} {...props}>
    {Icon && <Icon size={14} className="shrink-0 opacity-80" />}
    <span className="min-w-0 flex-1 truncate">{children}</span>
    <ChevronRight size={13} className="shrink-0 opacity-60" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

/** 二级菜单内容。随父菜单一起卸载，不再单独做进出场动效。 */
const DropdownMenuSubContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'nokey nowheel z-[100] min-w-[168px] overflow-y-auto overflow-x-hidden rounded-lg border border-[color:var(--popover-border)] bg-popover p-1 text-popover-foreground [box-shadow:var(--popover-shadow)] outline-none',
        'max-h-[var(--radix-dropdown-menu-content-available-height)]',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

export {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
};
