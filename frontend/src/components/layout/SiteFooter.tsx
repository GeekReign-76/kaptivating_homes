import Link from 'next/link';
import { Phone, Mail, MapPin, Building2 } from 'lucide-react';

export function SiteFooter() {
  const year         = new Date().getFullYear();
  const agentName    = process.env.NEXT_PUBLIC_AGENT_NAME      ?? 'Karsten Miller';
  const agentTitle   = process.env.NEXT_PUBLIC_AGENT_TITLE     ?? 'REALTOR®';
  const agentPhone   = process.env.NEXT_PUBLIC_AGENT_PHONE     ?? '(336) 804-9760';
  const phoneOffice  = process.env.NEXT_PUBLIC_AGENT_PHONE_OFFICE ?? '(704) 887-6600';
  const agentEmail   = process.env.NEXT_PUBLIC_AGENT_EMAIL     ?? 'Karsten.dmiller@gmail.com';
  const agentLicense = process.env.NEXT_PUBLIC_AGENT_LICENSE   ?? 'NC #279290';
  const brokerage    = process.env.NEXT_PUBLIC_AGENT_BROKERAGE ?? 'Keller Williams Realty Ballantyne';
  const address      = process.env.NEXT_PUBLIC_AGENT_ADDRESS   ?? '14045 Ballantyne Corporate Place, Suite 500, Charlotte, NC';
  const siteName     = process.env.NEXT_PUBLIC_SITE_NAME       ?? 'Kaptivating Homes by Karsten';

  return (
    <footer className="bg-neutral-900 text-neutral-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Brand */}
          <div>
            <p className="font-serif text-xl font-bold text-white mb-0.5">{siteName}</p>
            <p className="text-sm text-neutral-400 mb-0.5">{agentName} · {agentTitle}</p>
            <p className="text-xs text-neutral-500 mb-4">License #: {agentLicense.replace(/^.*#\s*/, '')}</p>
            <div className="space-y-2 text-sm">
              <a href={`tel:${agentPhone}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="w-4 h-4 shrink-0" />
                <span>Mobile: {agentPhone}</span>
              </a>
              <a href={`tel:${phoneOffice}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="w-4 h-4 shrink-0" />
                <span>Office: {phoneOffice}</span>
              </a>
              <a href={`mailto:${agentEmail}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="w-4 h-4 shrink-0" /> {agentEmail}
              </a>
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{brokerage}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <p className="text-white font-semibold mb-4">Quick Links</p>
            <ul className="space-y-2 text-sm">
              {[
                ['Home',                  '/'],
                ['Listings',              '/properties'],
                ['Search Listings',       '/listings'],
                ['Relocate to Charlotte', '/relocate'],
                ['Blog',                  '/blog'],
                ['Schedule a Consultation', '/portal/appointments'],
                ['Client Portal',         '/portal'],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Communities */}
          <div>
            <p className="text-white font-semibold mb-4">Charlotte Communities</p>
            <ul className="space-y-2 text-sm columns-2">
              {[
                ['Ballantyne',      'Ballantyne'],
                ['SouthPark',       'SouthPark'],
                ['Huntersville',    'Huntersville'],
                ['Cornelius',       'Cornelius'],
                ['Davidson',        'Davidson'],
                ['Mooresville',     'Mooresville'],
                ['Concord',         'Concord'],
                ['Waxhaw',          'Waxhaw'],
                ['Matthews',        'Matthews'],
                ['Pineville',       'Pineville'],
                ['Fort Mill',       'Fort Mill'],
                ['Rock Hill',       'Rock Hill'],
                ['Lake Norman',     'Lake Norman'],
              ].map(([label, q]) => (
                <li key={q}>
                  <Link
                    href={`/listings?q=${encodeURIComponent(q)}`}
                    className="hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-neutral-800 text-xs text-neutral-500 space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p>© {year} {siteName}. All rights reserved.</p>
            <p>License #: {agentLicense.replace(/^.*#\s*/, '')} · {brokerage}</p>
          </div>
          <p className="text-neutral-600 leading-relaxed">
            {agentName} is a licensed REALTOR® in North Carolina and South Carolina.
            {' '}Equal Housing Opportunity. The information provided on this website is for general
            informational purposes only and does not constitute legal or financial advice. All
            listings are subject to change without notice.
          </p>
        </div>
      </div>
    </footer>
  );
}
