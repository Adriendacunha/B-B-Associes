'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import type { NavItem } from '@/components/MainNav';

/** Navigation mobile repliable (menu hamburger). */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  if (items.length === 0) return null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        {open ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
      </button>
      {open && (
        <nav className="absolute left-0 right-0 top-full z-30 border-b border-slate-200 bg-white shadow-sm">
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2">
            {items.map((it) => {
              const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-md px-3 py-2 text-sm font-medium ${
                      active ? 'bg-brand/10 text-brand' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
