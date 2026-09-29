'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';
import { type Theme, useTheme } from './theme-provider';

export const THEME_OPTIONS: { value: Theme; label: string; icon: typeof IconSun }[] = [
  { value: 'system', label: 'System', icon: IconDeviceDesktop },
  { value: 'light', label: 'Light', icon: IconSun },
  { value: 'dark', label: 'Dark', icon: IconMoon },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const CurrentIcon = resolvedTheme === 'dark' ? IconMoon : IconSun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Change theme">
          <CurrentIcon size={17} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEME_OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <OptionIcon size={15} aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
