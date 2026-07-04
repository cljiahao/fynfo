import { cn } from '@/lib/utils';

interface BrandTextProps {
  className?: string;
}

export function BrandText({ className }: BrandTextProps) {
  return (
    <>
      <span className="text-primary">Fyn</span>
      <span className={cn('text-foreground', className)}>fo</span>
    </>
  );
}
