'use client';

import { ArrowRight, Waves, Trophy, Trees, Building2, Home, Anchor } from 'lucide-react';

interface Props {
  onCardClick: (context: string) => void;
}

const LIFESTYLES = [
  {
    id:       'lake-norman',
    icon:     Waves,
    label:    'Lake Norman Waterfront',
    tagline:  'The inland sea — 520 miles of shoreline',
    desc:     'North America\'s largest man-made lake sits 30 minutes from Uptown Charlotte. Private docks, sunset decks, top-rated Iredell and Lincoln county schools, and a thriving lakeside dining scene.',
    price:    '$600K – $5M+',
    areas:    ['Cornelius', 'Davidson', 'Huntersville', 'Mooresville', 'Denver'],
    gradient: 'from-sky-900 to-blue-800',
    accent:   'bg-sky-500',
    query:    'waterfront Cornelius NC luxury',
  },
  {
    id:       'lake-wylie',
    icon:     Anchor,
    label:    'Lake Wylie & Lake James',
    tagline:  'Quieter waters on the SC border',
    desc:     'Lake Wylie straddles the NC/SC line just south of Charlotte — lower property taxes (SC side), easy Uptown commute, and genuine lakefront privacy. Lake James offers mountain-meets-water scenery further west.',
    price:    '$450K – $3M+',
    areas:    ['Belmont', 'Clover SC', 'Fort Mill SC', 'Lake Wylie SC'],
    gradient: 'from-teal-900 to-emerald-800',
    accent:   'bg-teal-500',
    query:    'Lake Wylie NC SC waterfront luxury',
  },
  {
    id:       'myers-park',
    icon:     Trees,
    label:    'Myers Park & Dilworth',
    tagline:  'Historic grandeur, walkable and timeless',
    desc:     'Charlotte\'s most prestigious in-city addresses. Canopied streets, 1920s estates, and proximity to Uptown, SouthPark, and the best private schools in the Carolinas.',
    price:    '$800K – $6M+',
    areas:    ['Myers Park', 'Dilworth', 'Elizabeth', 'Eastover'],
    gradient: 'from-emerald-900 to-green-800',
    accent:   'bg-emerald-500',
    query:    'luxury estate Myers Park Charlotte NC',
  },
  {
    id:       'golf',
    icon:     Trophy,
    label:    'Golf & Country Club',
    tagline:  'Quail Hollow, Providence, Ballantyne Resort',
    desc:     'Charlotte hosts the PGA Tour\'s Wells Fargo Championship. From the storied fairways of Quail Hollow Club to the private neighborhoods of Providence Country Club and Ballantyne Resort — golf-oriented luxury living is a Charlotte hallmark.',
    price:    '$700K – $4M+',
    areas:    ['Ballantyne', 'Piper Glen', 'Providence', 'Weddington'],
    gradient: 'from-lime-900 to-green-900',
    accent:   'bg-lime-500',
    query:    'luxury Ballantyne Charlotte NC',
  },
  {
    id:       'equestrian',
    icon:     Home,
    label:    'Equestrian & Estate',
    tagline:  'Horse country in Waxhaw & Weddington',
    desc:     'Union County\'s rolling hills are home to Charlotte\'s finest horse properties — gated estates on 5–50 acres with private barns, riding trails, and the privacy that luxury buyers demand. One of the fastest-appreciating luxury micro-markets in the Southeast.',
    price:    '$900K – $8M+',
    areas:    ['Waxhaw', 'Weddington', 'Marvin', 'Mineral Springs'],
    gradient: 'from-amber-900 to-orange-900',
    accent:   'bg-amber-500',
    query:    'equestrian estate Waxhaw Weddington NC luxury',
  },
  {
    id:       'uptown-luxury',
    icon:     Building2,
    label:    'Uptown Luxury & High-Rise',
    tagline:  'City living at the top of Charlotte',
    desc:     'For buyers who want walkability, rooftop views, and the energy of a booming financial district — The Vue, 5Church, Skyhouse, and new luxury towers rising in South End. International buyers relocating for Bank of America, Truist, or Honeywell often start here.',
    price:    '$400K – $3M+',
    areas:    ['Uptown', 'South End', 'NoDa', 'Fourth Ward'],
    gradient: 'from-violet-900 to-purple-900',
    accent:   'bg-violet-500',
    query:    'luxury condo Uptown Charlotte NC',
  },
];

export function LuxuryLifestyleSection({ onCardClick }: Props) {
  return (
    <section className="bg-neutral-950 py-20">
      <div className="max-w-6xl mx-auto px-4">

        {/* Heading */}
        <div className="mb-12 text-center">
          <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-2">Luxury Relocation</p>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-white mb-3">
            Find your lifestyle first. Then find your home.
          </h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            From private lakefront docks on Lake Norman to historic estates in Myers Park — Charlotte's luxury market spans every lifestyle. Explore by category below.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LIFESTYLES.map(item => {
            const Icon = item.icon;
            const kwUrl = `https://karstenmiller.kw.com/search/sale?q=${encodeURIComponent(item.query)}`;

            return (
              <a
                key={item.id}
                href={kwUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onCardClick(`Luxury search: ${item.label} — ${item.areas.join(', ')}`)}
                className={`group relative bg-gradient-to-br ${item.gradient} rounded-2xl overflow-hidden p-6 flex flex-col min-h-[280px] cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-2xl`}
              >
                {/* Icon badge */}
                <div className={`${item.accent} w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Price tag */}
                <span className="absolute top-5 right-5 text-xs font-semibold text-white/70 bg-white/10 px-2.5 py-1 rounded-full">
                  {item.price}
                </span>

                {/* Text */}
                <h3 className="font-serif text-lg font-bold text-white mb-1">{item.label}</h3>
                <p className="text-sm text-white/60 mb-3">{item.tagline}</p>
                <p className="text-sm text-white/80 leading-relaxed flex-1">{item.desc}</p>

                {/* Areas */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {item.areas.map(a => (
                    <span key={a} className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                      {a}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-white group-hover:gap-2.5 transition-all">
                  View listings on KW <ArrowRight className="w-4 h-4" />
                </div>
              </a>
            );
          })}
        </div>

        {/* Callout */}
        <div className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white">Not sure which market fits your lifestyle?</p>
            <p className="text-sm text-neutral-400 mt-0.5">
              Karsten specializes in relocations — a 30-minute call can narrow it down to two or three neighborhoods.
            </p>
          </div>
          <a
            href="/portal/appointments"
            className="shrink-0 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Book a Relocation Call
          </a>
        </div>
      </div>
    </section>
  );
}
