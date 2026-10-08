'use client';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSignOut } from '@/features/auth';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { CircleHelp, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';

interface UserMenuDropdownProps {
  name?: string;
  email?: string;
  image?: string;
}

export function UserMenuDropdown({
  name,
  email,
  image,
}: UserMenuDropdownProps) {
  const { signOut, isSigningOut } = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="focus-visible:ring-ring flex items-center gap-2 rounded-full outline-none focus-visible:ring-2"
      >
        <Avatar className="transition-opacity hover:opacity-75">
          <AvatarImage
            src={image}
            alt={name ?? ''}
            referrerPolicy="no-referrer"
          />
          <AvatarFallback>
            <UserRound className="size-4" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            {name && <p className="text-sm leading-none font-medium">{name}</p>}
            {email && (
              <p className="text-muted-foreground text-xs leading-none">
                {email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={PAGE_ROUTES.PROFILE}>
            <UserRound className="mr-2 size-4" />
            Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/#faq">
            <CircleHelp className="mr-2 size-4" />
            FAQ
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <ThemeToggle />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={signOut}
          disabled={isSigningOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
