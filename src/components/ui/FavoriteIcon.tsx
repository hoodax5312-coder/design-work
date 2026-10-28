import { Heart, HeartFill, type IconProps } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';

export const FavoriteIcon = ({ saved = false, className, ...props }: IconProps & { saved?: boolean }) => {
  const Icon = saved ? HeartFill : Heart;
  return <Icon aria-hidden="true" {...props} className={cn(className, saved && 'text-red-500')} />;
};
