'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Utensils, ShoppingBag, Heart, CalendarDays, ArrowRight, Plane, Building2, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PropertyInterestPrompt } from '@/components/listings/PropertyInterestPrompt';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STATS = [
  { value: '6th',         label: 'Busiest airport in the world',        icon: Plane },
  { value: '43+',         label: 'International nonstop destinations',  icon: Globe2 },
  { value: '9',           label: 'Fortune 500 headquarters',            icon: Building2 },
  { value: '150+',        label: 'Countries with Charlotte connections', icon: MapPin },
];

type Community = {
  id: string;
  flag: string;
  name: string;
  tagline: string;
  color: string;
  bg: string;
  border: string;
  population: string;
  neighborhoods: string[];
  description: string;
  restaurants: { name: string; area: string }[];
  markets: { name: string; area: string }[];
  worship: { name: string; type: string }[];
  events: string[];
  mlsCity: string;
  mlsZip: string;
  // KW search viewport: northLat,eastLng,southLat,westLng
  kwViewport: string;
};

const COMMUNITIES: Community[] = [
  {
    id: 'indian',
    flag: '🇮🇳',
    name: 'Indian & South Asian',
    tagline: 'The largest and fastest-growing international community',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    population: '35,000+ residents',
    neighborhoods: ['Ballantyne', 'Pineville', 'South Charlotte', 'University City'],
    description: 'Charlotte\'s Indian community has seen explosive growth over the past two decades, driven by the city\'s booming tech and finance sectors. Ballantyne in particular has become a thriving hub with a distinctly South Indian character — you\'ll find the faint scent of jasmine garlands and the sound of Carnatic music drifting from homes on weekend mornings.',
    restaurants: [
      { name: 'The Blue Taj', area: 'Ballantyne Village' },
      { name: 'Dakshin Indian Grill', area: 'South Charlotte' },
      { name: 'Chaat N Dosa', area: 'Ballantyne' },
      { name: 'Tabla Indian Restaurant', area: 'South Charlotte' },
      { name: 'Triveni Express', area: 'Pineville' },
      { name: 'Ruchi', area: 'South Charlotte' },
    ],
    markets: [
      { name: 'Patel Brothers', area: 'Pineville' },
      { name: 'Super G Mart', area: 'East Independence' },
    ],
    worship: [
      { name: 'Hindu Center of Charlotte', type: 'Hindu Temple — 3,000+ families' },
      { name: 'Shirdi Sai Temple', type: 'Hindu Temple — Indian Trail' },
      { name: 'Gurdwara Sahib Charlotte', type: 'Sikh Gurdwara — University City' },
      { name: 'Gurdwara Khalsa Darbar', type: 'Sikh Gurdwara' },
    ],
    events: ['Festival of India (September, Ballantyne)', 'Regional Festival of India (April, Stumptown Park)', 'Diwali Festival of Lights (October)', 'India Association cultural concerts'],
    mlsCity: 'Charlotte',
    mlsZip: '28277',
    kwViewport: '35.075,-80.830,35.005,-80.935',
  },
  {
    id: 'hispanic',
    flag: '🌎',
    name: 'Hispanic & Latino',
    tagline: 'The heartbeat of East Charlotte',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    population: '158,000+ residents (15%+ of the city)',
    neighborhoods: ['East Charlotte', 'Plaza Midwood', 'Central Avenue Corridor', 'North Charlotte'],
    description: 'Charlotte\'s Hispanic community is the largest and most established international community in the city. The Central Avenue corridor is vibrant with Mexican panaderias, Guatemalan comedores, Salvadoran pupuserias, and Colombian bakeries. Spanish is heard as naturally here as English — this is a community that has built something lasting.',
    restaurants: [
      { name: 'La Unica', area: 'East Charlotte' },
      { name: 'El Patron', area: 'Central Avenue' },
      { name: 'Lupitas Mexican Restaurant', area: 'East Charlotte' },
      { name: 'Mi Pueblo', area: 'North Charlotte' },
      { name: 'Taqueria El Rancho', area: 'East Charlotte' },
    ],
    markets: [
      { name: 'Super G Mart', area: 'East Independence' },
      { name: 'Compare Foods', area: 'Central Avenue' },
      { name: 'La Unica Supermarket', area: 'East Charlotte' },
    ],
    worship: [
      { name: 'Iglesia Bautista Central', type: 'Spanish-language Baptist' },
      { name: 'St. Patrick Catholic Church', type: 'Catholic — large Spanish Mass' },
      { name: 'Multiple evangelical congregaciones', type: 'Spanish evangelical churches throughout East Charlotte' },
    ],
    events: ['Empanada Fest (April)', 'Charlotte International Arts Festival (September)', 'Fiesta Patrias celebrations (September)'],
    mlsCity: 'Charlotte',
    mlsZip: '28205',
    kwViewport: '35.255,-80.770,35.185,-80.870',
  },
  {
    id: 'vietnamese',
    flag: '🇻🇳',
    name: 'Vietnamese',
    tagline: 'Decades of roots along Central Avenue',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    population: 'Well-established community since the 1990s',
    neighborhoods: ['East Charlotte', 'Central Avenue', 'Madison Park', 'South Boulevard', 'Ballantyne'],
    description: 'The Vietnamese community arrived in Charlotte in significant numbers in the 1990s, many as refugees who built businesses and institutions from the ground up. Central Avenue is home to authentic pho shops, banh mi bakeries, and Asian markets that serve as gathering places for the broader community. The neighborhood has a quiet, industrious pride.',
    restaurants: [
      { name: 'Pho Hoa Noodle Soup', area: 'Central Avenue (est. 1998)' },
      { name: 'Lula Banh Mi and Bakery', area: 'Ballantyne & multiple locations' },
      { name: 'Lang Van', area: 'East Charlotte' },
      { name: 'Hello Me Vietnamese Kitchen', area: 'South Charlotte' },
      { name: 'Crispy Banh Mi', area: 'South Boulevard' },
      { name: 'Vietnam Grille', area: 'Madison Park' },
      { name: 'Be\'s Noodles & Banh Mi', area: 'East Charlotte' },
    ],
    markets: [
      { name: 'Kim Anh Oriental Groceries', area: '4421 Central Ave' },
      { name: 'Asian Market of Charlotte', area: 'East Charlotte' },
      { name: 'Super G Mart', area: 'East Independence' },
    ],
    worship: [
      { name: 'Vietnamese Catholic Community', type: 'Catholic' },
      { name: 'Vietnamese Buddhist Association', type: 'Buddhist temple' },
      { name: 'Vietnamese Alliance Church', type: 'East Charlotte' },
    ],
    events: ['Vietnamese New Year (Tet) celebrations', 'Mid-Autumn Festival', 'Charlotte International Arts Festival'],
    mlsCity: 'Charlotte',
    mlsZip: '28205',
    kwViewport: '35.250,-80.770,35.180,-80.870',
  },
  {
    id: 'korean',
    flag: '🇰🇷',
    name: 'Korean',
    tagline: 'Growing fast in the southern suburbs',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    population: 'Rapidly growing community',
    neighborhoods: ['Ballantyne', 'Matthews', 'South Charlotte', 'Pineville'],
    description: 'Charlotte\'s Korean community has expanded rapidly alongside the city\'s tech and professional services growth. Korean BBQ restaurants have become gathering spots not just for Korean families but for the whole city. The Matthews corridor has a strong concentration of Korean-owned businesses, and Korean churches play a major role in community life.',
    restaurants: [
      { name: 'MOA Korean BBQ & Bar', area: 'First Citizens Plaza — upscale' },
      { name: 'Bibim Korean Bistro', area: 'Ballantyne (opened 2023)' },
      { name: 'Anju', area: 'South Charlotte' },
      { name: 'Let\'s Meat KBBQ', area: 'South Charlotte' },
      { name: 'PePeRo', area: 'Matthews — inside Korean market' },
      { name: 'Seoul Food Meat Company', area: 'South Charlotte' },
      { name: 'Dae Bak Korean Restaurant', area: 'South Charlotte' },
    ],
    markets: [
      { name: 'Korean grocery stores', area: 'Matthews corridor' },
      { name: 'Super G Mart', area: 'East Independence' },
      { name: 'Asian Market of Charlotte', area: 'East Charlotte' },
    ],
    worship: [
      { name: 'Korean churches throughout South Charlotte', type: 'Presbyterian, Baptist, evangelical' },
      { name: 'Charlotte Korean United Methodist Church', type: 'Methodist' },
    ],
    events: ['Korean New Year (Seollal)', 'Chuseok Harvest Festival', 'AsiaCarolinas CLTure Day'],
    mlsCity: 'Matthews',
    mlsZip: '28105',
    kwViewport: '35.150,-80.695,35.080,-80.785',
  },
  {
    id: 'african',
    flag: '🌍',
    name: 'African & Caribbean',
    tagline: 'West African, East African, and Caribbean communities',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    population: 'Growing communities from 30+ African nations',
    neighborhoods: ['East Charlotte', 'University Area', 'North Charlotte', 'West Charlotte'],
    description: 'Charlotte has welcomed communities from across Africa and the Caribbean — Nigerian professionals, Liberian families, Ethiopian and Somali refugees, Ghanaian business owners, and communities from the islands. Each brings distinct food traditions, music, languages, and faith practices. The East Charlotte corridor has become a place where many of these communities overlap and intermingle.',
    restaurants: [
      { name: 'Zoewee\'s', area: 'Authentic Liberian home cooking' },
      { name: 'Lagz Restaurant', area: 'Nigerian — traditional dishes' },
      { name: 'Mama Gee\'s', area: 'Ghanaian cuisine' },
      { name: 'Royal African', area: 'Pan-African' },
      { name: 'Enat', area: 'East African / Ethiopian' },
      { name: 'Abugida', area: 'Ethiopian & Eritrean' },
    ],
    markets: [
      { name: 'African grocery stores', area: 'East Charlotte' },
      { name: 'Super G Mart', area: 'East Independence — large African food section' },
    ],
    worship: [
      { name: 'African immigrant churches', type: 'Numerous Nigerian, Ghanaian, Ethiopian Orthodox churches' },
      { name: 'Islamic Center of Charlotte', type: 'Mosque — large West African congregation' },
      { name: 'Ethiopian Orthodox Tewahedo Church', type: 'Orthodox Christian' },
    ],
    events: ['Charlotte International Arts Festival', 'African Heritage Month events', 'Various national independence day celebrations'],
    mlsCity: 'Charlotte',
    mlsZip: '28212',
    kwViewport: '35.240,-80.745,35.170,-80.845',
  },
  {
    id: 'filipino',
    flag: '🇵🇭',
    name: 'Filipino',
    tagline: 'A close-knit community across the southern suburbs',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    population: 'Third-largest Asian community in the US nationally',
    neighborhoods: ['Pineville', 'University City', 'Ballantyne', 'Lake Norman area'],
    description: 'Charlotte\'s Filipino community is warm, family-oriented, and deeply connected. Filipinos are prominent in the healthcare sector — many nurses and medical professionals make Charlotte home — as well as in engineering and finance. Community gatherings often center around food, and the bayanihan spirit of communal support is alive and well here.',
    restaurants: [
      { name: 'Manila Grill', area: 'Pineville (10500 Centrum Pkwy)' },
      { name: 'Joel\'s Asian Grill', area: 'Lake Norman — 20-year institution' },
      { name: 'Bachi', area: 'University City — Japanese/Filipino fusion' },
      { name: 'Pinoy Plates by Cabalen', area: 'Food truck' },
      { name: 'Lumpia Shack', area: 'Charlotte area' },
    ],
    markets: [
      { name: 'Filipino Mart', area: 'Charlotte' },
      { name: 'New Asia Market', area: 'Filipino and Asian products' },
      { name: 'Patel Brothers', area: 'Pineville — carries Filipino staples' },
    ],
    worship: [
      { name: 'Filipino Catholic community', type: 'Catholic parishes — active Filipino groups' },
      { name: 'Filipino Christian Fellowship', type: 'Non-denominational' },
    ],
    events: ['Philippine Independence Day celebration (June)', 'Fiesta celebrations', 'AsiaCarolinas CLTure Day + Night Market'],
    mlsCity: 'Pineville',
    mlsZip: '28134',
    kwViewport: '35.105,-80.875,35.035,-80.975',
  },
  {
    id: 'middleeastern',
    flag: '🕌',
    name: 'Middle Eastern & Muslim',
    tagline: 'A diverse and deeply rooted community',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    population: 'Growing communities from across the Arab world and beyond',
    neighborhoods: ['South Charlotte', 'East Charlotte', 'University Area', 'Ballantyne'],
    description: 'Charlotte\'s Muslim and Middle Eastern communities represent Lebanese, Egyptian, Palestinian, Pakistani, Turkish, and many other nationalities. Halal restaurants and groceries are found across the city. The community has invested significantly in religious infrastructure — a new $9 million mosque expansion is currently underway — and Islamic schools serve families throughout the region.',
    restaurants: [
      { name: 'Halal restaurants and Mediterranean grills', area: 'Throughout South and East Charlotte' },
      { name: 'Lebanese, Egyptian, and Turkish restaurants', area: 'South Boulevard and University area' },
      { name: 'Shawarma and falafel shops', area: 'Multiple locations' },
    ],
    markets: [
      { name: 'Halal meat markets', area: 'East Charlotte and South Charlotte' },
      { name: 'Super G Mart', area: 'East Independence — large Middle Eastern section' },
      { name: 'International halal grocers', area: 'Multiple Charlotte locations' },
    ],
    worship: [
      { name: 'Islamic Center of Charlotte (ICC)', type: 'Main mosque — Central Charlotte' },
      { name: 'Pillars Mosque', type: 'New 30,000 sq ft facility — cafe, library, food pantry' },
      { name: 'Islamic Community Center of South Charlotte', type: 'South Charlotte' },
      { name: 'Islamic Society of Greater Charlotte', type: 'University area' },
      { name: 'Al Zahra Islamic Center', type: 'Charlotte' },
    ],
    events: ['Eid al-Fitr community celebrations', 'Eid al-Adha gatherings', 'Ramadan iftars open to community', 'Islamic Heritage Month events'],
    mlsCity: 'Charlotte',
    mlsZip: '28210',
    kwViewport: '35.175,-80.820,35.105,-80.920',
  },
  {
    id: 'chinese',
    flag: '🇨🇳',
    name: 'Chinese & East Asian',
    tagline: 'A community over four decades in the making',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    population: 'Established since the 1980s, growing steadily',
    neighborhoods: ['South Charlotte', 'Ballantyne', 'University City', 'Matthews'],
    description: 'The Chinese American Association of Charlotte (CAAOC) has been serving the community since 1984, making this one of the oldest organized international communities in the city. Charlotte\'s East Asian community spans Chinese, Taiwanese, Japanese, and other East Asian families. The city\'s tech corridor and university research community continue to draw young professionals and scholars.',
    restaurants: [
      { name: 'Authentic Chinese restaurants', area: 'South Charlotte and University area' },
      { name: 'Dim sum restaurants', area: 'South Charlotte' },
      { name: 'Japanese and pan-Asian restaurants', area: 'Throughout Charlotte' },
      { name: 'Taiwanese bubble tea shops', area: 'Ballantyne and South Charlotte' },
    ],
    markets: [
      { name: 'Asian Market of Charlotte', area: 'East Charlotte (est. 2020)' },
      { name: 'Super G Mart', area: 'East Independence — largest international market in NC' },
      { name: 'H Mart (regional)', area: 'Charlotte area' },
    ],
    worship: [
      { name: 'Chinese Christian churches', type: 'Mandarin and Cantonese congregations' },
      { name: 'Buddhist temples', type: 'Chinese Buddhist Association' },
    ],
    events: ['Lunar New Year Celebration (February)', 'Mid-Autumn Moon Festival', 'Charlotte International Arts Festival', 'CAAOC cultural programs'],
    mlsCity: 'Charlotte',
    mlsZip: '28277',
    kwViewport: '35.075,-80.830,35.005,-80.935',
  },
  {
    id: 'european',
    flag: '🇪🇺',
    name: 'European',
    tagline: 'From historic roots to new arrivals in banking and tech',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    population: 'German, British, Italian, Irish and Eastern European communities',
    neighborhoods: ['Dilworth', 'Myers Park', 'Plaza Midwood', 'SouthPark', 'Ballantyne'],
    description: 'Charlotte has European roots going back to German and Scots-Irish settlers in the 1700s. Today, that heritage is complemented by an active community of British, German, French, Italian, and Eastern European professionals drawn by Bank of America, Honeywell, and the broader financial services sector. The expat community is well-organized, with social clubs, international schools, and regular cultural events.',
    restaurants: [
      { name: 'Italian trattorias and pizza', area: 'Dilworth and SouthPark' },
      { name: 'British-style pubs', area: 'Uptown and South End' },
      { name: 'German beer halls', area: 'South End' },
      { name: 'French bistros', area: 'Myers Park and Dilworth' },
      { name: 'Polish and Eastern European delis', area: 'Plaza Midwood area' },
    ],
    markets: [
      { name: 'International delis and specialty grocers', area: 'Plaza Midwood' },
      { name: 'European bakeries', area: 'Dilworth and SouthPark' },
    ],
    worship: [
      { name: 'St. Peter Catholic Church', type: 'Historic Catholic parish — Uptown' },
      { name: 'Sharon Presbyterian Church', type: 'Historic Presbyterian congregation' },
      { name: 'International Lutheran congregations', type: 'South Charlotte' },
      { name: 'Greek Orthodox Cathedral', type: 'Greek community' },
    ],
    events: ['Oktoberfest Charlotte (September)', 'St. Patrick\'s Day parade and events', 'Charlotte International Arts Festival', 'Japanese Spring Festival (March)'],
    mlsCity: 'Charlotte',
    mlsZip: '28203',
    kwViewport: '35.225,-80.830,35.155,-80.930',
  },
];

const FILTERS = [
  { id: 'all',          label: 'All Communities' },
  { id: 'indian',       label: 'Indian' },
  { id: 'hispanic',     label: 'Hispanic' },
  { id: 'vietnamese',   label: 'Vietnamese' },
  { id: 'korean',       label: 'Korean' },
  { id: 'african',      label: 'African' },
  { id: 'filipino',     label: 'Filipino' },
  { id: 'middleeastern',label: 'Middle Eastern' },
  { id: 'chinese',      label: 'Chinese' },
  { id: 'european',     label: 'European' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RelocatePage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const armPromptRef = useRef<((context: string) => void) | null>(null);
  const onArm = useCallback((fn: (context: string) => void) => {
    armPromptRef.current = fn;
  }, []);

  const visible = activeFilter === 'all'
    ? COMMUNITIES
    : COMMUNITIES.filter(c => c.id === activeFilter);

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-neutral-900 text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1746591948886-6812d011acdc?w=1600&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/50 to-black/70" />
        <div className="relative max-w-6xl mx-auto px-4 py-24 lg:py-32">
          <p className="text-brand-400 font-medium text-sm uppercase tracking-widest mb-4">Relocating to Charlotte</p>
          <h1 className="text-4xl lg:text-6xl font-serif font-bold leading-tight mb-6 max-w-3xl">
            Your world is already here.
          </h1>
          <p className="text-neutral-300 text-lg max-w-2xl leading-relaxed mb-8">
            Charlotte isn't just a city in the American South — it's a global city with deep roots from every corner of the world. Before you arrive, find your neighborhood, your restaurants, your place of worship, and your people.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="#communities"
              className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Explore Communities
            </Link>
            <Link
              href="/portal/appointments"
              className="border border-white/30 hover:border-white text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Schedule a Consultation
            </Link>
            <Link
              href="/listings"
              className="border border-white/20 hover:border-white/50 text-white/70 hover:text-white px-6 py-3 rounded-lg font-medium transition-colors text-sm"
            >
              Browse All Listings
            </Link>
          </div>
        </div>
      </section>

      {/* International credentials */}
      <section className="bg-brand-500 text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-brand-100 text-sm leading-snug">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Intro copy */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-serif font-bold text-neutral-900 mb-4">
          One city. Every culture.
        </h2>
        <p className="text-neutral-600 text-lg leading-relaxed">
          Charlotte Douglas International Airport connects the city to 43 international destinations nonstop.
          Bank of America operates in 150 countries from its headquarters here. And on Central Avenue,
          in Ballantyne, in Matthews, and throughout South Charlotte, you'll find the restaurants, markets,
          temples, mosques, churches, and gurdwaras that make this feel like home — wherever home was.
        </p>
      </section>

      {/* Community cards */}
      <section id="communities" className="max-w-6xl mx-auto px-4 pb-24">

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-10">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFilter(f.id); setExpanded(null); }}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors border',
                activeFilter === f.id
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map(community => {
            const isOpen = expanded === community.id;
            return (
              <div
                key={community.id}
                className={cn(
                  'bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-md',
                  community.border,
                  isOpen && 'md:col-span-2 lg:col-span-3',
                )}
              >
                {/* Card header */}
                <div
                  className={cn('p-5 cursor-pointer', community.bg)}
                  onClick={() => setExpanded(isOpen ? null : community.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-3xl mb-2 block">{community.flag}</span>
                      <h3 className={cn('text-lg font-serif font-bold', community.color)}>{community.name}</h3>
                      <p className="text-sm text-neutral-500 mt-0.5">{community.tagline}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-neutral-400">{community.population}</p>
                    </div>
                  </div>

                  {/* Neighborhoods */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {community.neighborhoods.map(n => (
                      <span key={n} className="text-xs bg-white/70 text-neutral-600 px-2 py-0.5 rounded-full border border-white">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="p-5">
                    <p className="text-neutral-600 leading-relaxed mb-6 text-sm">{community.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Restaurants */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Utensils className="w-3.5 h-3.5 text-neutral-400" />
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Restaurants</p>
                        </div>
                        <ul className="space-y-1.5">
                          {community.restaurants.map(r => (
                            <li key={r.name}>
                              <p className="text-sm font-medium text-neutral-800">{r.name}</p>
                              <p className="text-xs text-neutral-400">{r.area}</p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Markets */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <ShoppingBag className="w-3.5 h-3.5 text-neutral-400" />
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Grocery & Markets</p>
                        </div>
                        <ul className="space-y-1.5">
                          {community.markets.map(m => (
                            <li key={m.name}>
                              <p className="text-sm font-medium text-neutral-800">{m.name}</p>
                              <p className="text-xs text-neutral-400">{m.area}</p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Worship */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Heart className="w-3.5 h-3.5 text-neutral-400" />
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Worship</p>
                        </div>
                        <ul className="space-y-1.5">
                          {community.worship.map(w => (
                            <li key={w.name}>
                              <p className="text-sm font-medium text-neutral-800">{w.name}</p>
                              <p className="text-xs text-neutral-400">{w.type}</p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Events */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <CalendarDays className="w-3.5 h-3.5 text-neutral-400" />
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Events</p>
                        </div>
                        <ul className="space-y-1">
                          {community.events.map(e => (
                            <li key={e} className="text-sm text-neutral-700">{e}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className={cn('mt-6 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4', community.bg)}>
                      <p className="text-sm font-medium text-neutral-700">
                        Find your home near the {community.name} community
                      </p>
                      <div className="flex flex-wrap gap-3 shrink-0">
                        <Link
                          href="/portal/appointments"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          Schedule a Consultation
                        </Link>
                        <a
                          href={`https://karstenmiller.kw.com/search/sale?q=${encodeURIComponent(`${community.neighborhoods[0]}, ${community.mlsCity}, NC`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => armPromptRef.current?.(`${community.neighborhoods[0]}, ${community.mlsCity} — ${community.name} community`)}
                          className={cn('inline-flex items-center gap-1.5 text-sm font-semibold border px-4 py-2 rounded-lg transition-colors hover:bg-white/60', community.color, community.border)}
                        >
                          Browse Listings <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Collapsed CTA */}
                {!isOpen && (
                  <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between">
                    <button
                      onClick={() => setExpanded(community.id)}
                      className={cn('text-sm font-medium flex items-center gap-1', community.color)}
                    >
                      See restaurants, worship & events <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-neutral-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl font-serif font-bold mb-4">Ready to find your home?</h2>
          <p className="text-neutral-400 text-lg mb-8 max-w-xl mx-auto">
            We work with international relocators every day. Tell us which community matters to you and we'll find the right neighborhood.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/listings"
              className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Search Homes
            </Link>
            <Link
              href="/#contact"
              className="border border-white/30 hover:border-white text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Talk to an Agent
            </Link>
          </div>
        </div>
      </section>

      <PropertyInterestPrompt onArm={onArm} />
    </div>
  );
}
