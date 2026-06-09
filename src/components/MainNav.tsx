'use client';

import { Link, usePathname } from '@/i18n/routing';

export interface NavItem {
  href: string;
  label: string;
}

export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  if (items.length === 0) return null;
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
