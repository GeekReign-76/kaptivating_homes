'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, ChevronDown, Home, LogOut, Calendar, MessageSquare, User, Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { label: 'Listings',           href: '/properties' },
  { label: 'Search',             href: '/listings'   },
  { label: 'Relocating to CLT', href: '/relocate'   },
  { label: 'Blog',               href: '/blog'       },
];

const SITE_NAME    = process.env.NEXT_PUBLIC_SITE_NAME            ?? 'KaptivatingHomes';
const AGENT_PHONE  = process.env.NEXT_PUBLIC_AGENT_PHONE          ?? '(336) 804-9760';
const PHONE_OFFICE = process.env.NEXT_PUBLIC_AGENT_PHONE_OFFICE   ?? '(704) 887-6600';
const LICENSE      = process.env.NEXT_PUBLIC_AGENT_LICENSE        ?? 'NC #279290';

export function SiteHeader() {
  const { user, loading } = useAuth();
  const pathname           = usePathname();
  const router             = useRouter();

  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top contact bar */}
      <div className="bg-brand-900 text-white text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-end gap-5">
          <a href={`tel:${AGENT_PHONE}`} className="flex items-center gap-1.5 hover:text-brand-200 transition-colors">
            <Phone className="w-3 h-3" />
            <span>Mobile: {AGENT_PHONE}</span>
          </a>
          <a href={`tel:${PHONE_OFFICE}`} className="hidden sm:flex items-center gap-1.5 hover:text-brand-200 transition-colors">
            <Phone className="w-3 h-3" />
            <span>Office: {PHONE_OFFICE}</span>
          </a>
          <span className="text-brand-300 hidden sm:block">License #: {LICENSE.replace(/^.*#\s*/, '')}</span>
        </div>
      </div>

      {/* Main nav */}
      <div className="bg-white shadow-sm border-b border-neutral-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <Image
              src="/kw-ballantyne-logo.png"
              alt="Keller Williams Charlotte Ballantyne Area"
              width={120}
              height={44}
              className="object-contain h-8 w-24 sm:h-11 sm:w-32"
              priority
            />
            <span className="font-serif font-bold text-lg text-neutral-900 leading-tight hidden sm:block">
              {SITE_NAME}
            </span>
          </Link>

          {/* Center nav — desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                )}
              >
                {label}
              </Link>
            ))}

            {user && (
              <Link
                href="/portal/messages"
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive('/portal/messages')
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                )}
              >
                Messages
              </Link>
            )}

            <Link href="/listings">
              <Button size="sm" className="ml-2">
                Schedule Tour
              </Button>
            </Link>
          </nav>

          {/* Right actions — desktop */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded-md bg-neutral-200" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-neutral-100 transition-colors"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-neutral-700 max-w-[120px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-neutral-500 transition-transform',
                      dropdownOpen && 'rotate-180'
                    )}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
                    <Link
                      href="/portal"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <Home className="h-4 w-4 text-neutral-400" />
                      Portal
                    </Link>
                    <Link
                      href="/portal/appointments"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <Calendar className="h-4 w-4 text-neutral-400" />
                      My Appointments
                    </Link>
                    <Link
                      href="/portal/messages"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <MessageSquare className="h-4 w-4 text-neutral-400" />
                      Messages
                    </Link>
                    <hr className="my-1 border-neutral-100" />
                    <button
                      onClick={() => { setDropdownOpen(false); handleSignOut(); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm">Register</Button>
                </Link>
              </>
            )}
          </div>

          {/* Hamburger — mobile */}
          <button
            className="md:hidden rounded-md p-2 text-neutral-600 hover:bg-neutral-100 transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      </div>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-100 bg-white shadow-lg">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-neutral-700 hover:bg-neutral-100'
                )}
              >
                {label}
              </Link>
            ))}
            {user && (
              <Link
                href="/portal/messages"
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive('/portal/messages')
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-neutral-700 hover:bg-neutral-100'
                )}
              >
                Messages
              </Link>
            )}
            <Link href="/listings" className="mt-1">
              <Button size="sm" className="w-full">Schedule Tour</Button>
            </Link>
          </nav>

          <div className="border-t border-neutral-100 px-4 py-3">
            {loading ? null : user ? (
              <div className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar size="sm">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{user.name}</p>
                    <p className="text-xs text-neutral-500">{user.email}</p>
                  </div>
                </div>
                <Link href="/portal" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                  <User className="h-4 w-4 text-neutral-400" /> Portal
                </Link>
                <Link href="/portal/appointments" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                  <Calendar className="h-4 w-4 text-neutral-400" /> My Appointments
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/auth/login" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                </Link>
                <Link href="/auth/register" className="flex-1">
                  <Button size="sm" className="w-full">Register</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
