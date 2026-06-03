import { LinkList, type LinkItem } from '@/components/widgets/link-list';
import { cn } from '@/lib/utils';

type FooterTone = 'app' | 'marketing';

interface SiteFooterProps {
  creditText?: string;
  links?: LinkItem[];
  // 'app' (default) follows the active theme via tokens; 'marketing' stays
  // dark-always to match the landing page (feature/002).
  tone?: FooterTone;
}

const defaultLinks: LinkItem[] = [{ label: 'Contact Us', href: '#' }];

const TONES: Record<FooterTone, { footer: string; text: string }> = {
  app: { footer: 'bg-card border-t', text: 'text-muted-foreground' },
  marketing: { footer: 'bg-black', text: 'text-white' },
};

export function SiteFooter({
  creditText = 'Fynfo - Personal Finance Tracker',
  links = defaultLinks,
  tone = 'app',
}: SiteFooterProps) {
  const styles = TONES[tone];
  return (
    <footer className={cn('w-full', styles.footer)}>
      <div className="flex-between px-6 py-6">
        <p className={cn('text-sm', styles.text)}>{creditText}</p>

        <LinkList links={links} className={cn('text-sm', styles.text)} />
      </div>
    </footer>
  );
}
