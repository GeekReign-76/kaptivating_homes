import Image  from 'next/image';
import Link   from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export function AboutSection() {
  return (
    <section className="py-20 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

          {/* Photo */}
          <div className="relative">
            <div className="rounded-2xl aspect-[3/4] max-w-sm mx-auto lg:mx-0 overflow-hidden bg-neutral-200">
              <Image
                src="/km_headshot.png"
                alt="Karsten Miller — REALTOR®, Keller Williams Realty Ballantyne"
                fill
                className="object-cover object-top"
                sizes="(max-width: 768px) 100vw, 384px"
              />
            </div>
            {/* Floating stat card */}
            <div className="absolute -bottom-4 -right-4 lg:right-8 bg-white rounded-xl shadow-lg px-6 py-4 text-center">
              <p className="text-3xl font-bold font-serif text-brand-500">13+</p>
              <p className="text-xs text-neutral-500 mt-0.5">Communities Served</p>
            </div>
          </div>

          {/* Content */}
          <div>
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-wide mb-2">About Karsten</p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-neutral-900 mb-5 leading-snug">
              Real Estate Without The Hassle
            </h2>
            <p className="text-neutral-600 leading-relaxed mb-4">
              I'm Karsten Miller, a REALTOR® with Keller Williams Realty Ballantyne and one of the
              top local real estate agents in the Charlotte, NC region. My focus is simple: making
              the process of buying or selling a home as smooth and stress-free as possible — from
              the very first conversation to the day you get your keys.
            </p>
            <p className="text-neutral-600 leading-relaxed mb-6">
              Whether you're relocating from across the country or across the world, moving up,
              downsizing, or investing, I bring deep knowledge of Charlotte and its surrounding
              communities, straightforward communication, and a genuine commitment to your goals.
              I'm always here to help.
            </p>

            <div className="space-y-3 mb-8">
              {[
                'Deep knowledge across 13+ Charlotte-area communities',
                'Helping buyers, sellers, and international relocators',
                'Personal service — you work with me, not a team',
                'Helping you from start to finish, every step',
              ].map(point => (
                <div key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                  <p className="text-neutral-700 text-sm">{point}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/portal/appointments">Schedule a Consultation</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/listings">Search Listings</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
