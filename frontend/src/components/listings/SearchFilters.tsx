'use client';

import { useState, useCallback } from 'react';
import { SlidersHorizontal, X }  from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { cn }       from '@/lib/utils';

export interface Filters {
  states:        string[];
  property_type: string[];
  min_price:     string;
  max_price:     string;
  min_beds:      string;
  min_baths:     string;
  sort:          string;
}

interface SearchFiltersProps {
  initial?:  Partial<Filters>;
  onChange:  (f: Filters) => void;
}

const STATES = [
  { code: 'SC', label: 'South Carolina' },
  { code: 'GA', label: 'Georgia' },
  { code: 'FL', label: 'Florida' },
];
const PROP_TYPES = ['Residential', 'Condo', 'Land', 'Commercial', 'MultiFamily'];
const BED_OPTS   = ['1', '2', '3', '4', '5'];
const BATH_OPTS  = ['1', '2', '3', '4'];
const SORT_OPTS  = [
  { value: 'listed_at:desc',  label: 'Newest First' },
  { value: 'price:asc',       label: 'Price: Low → High' },
  { value: 'price:desc',      label: 'Price: High → Low' },
  { value: 'sqft:desc',       label: 'Largest First' },
];
const PRICE_PRESETS = [
  { label: 'Under $300k',        min: '',       max: '300000'  },
  { label: '$300k – $500k',      min: '300000', max: '500000'  },
  { label: '$500k – $750k',      min: '500000', max: '750000'  },
  { label: '$750k – $1M',        min: '750000', max: '1000000' },
  { label: 'Over $1M',           min: '1000000', max: ''       },
];

const DEFAULT: Filters = {
  states: [], property_type: [], min_price: '', max_price: '',
  min_beds: '', min_baths: '', sort: 'listed_at:desc',
};

export function SearchFilters({ initial = {}, onChange }: SearchFiltersProps) {
  const [f, setF]       = useState<Filters>({ ...DEFAULT, ...initial });
  const [mobileOpen, setMobileOpen] = useState(false);

  const update = useCallback((patch: Partial<Filters>) => {
    setF(prev => {
      const next = { ...prev, ...patch };
      onChange(next);
      return next;
    });
  }, [onChange]);

  function toggleArr(key: 'states' | 'property_type', val: string) {
    update({
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val],
    });
  }

  function clearAll() {
    setF(DEFAULT);
    onChange(DEFAULT);
  }

  const content = (
    <div className="space-y-6 text-sm">
      {/* States */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-neutral-500 mb-2 block">State</Label>
        <div className="space-y-2">
          {STATES.map(s => (
            <label key={s.code} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={f.states.includes(s.code)}
                onChange={() => toggleArr('states', s.code)}
                className="w-4 h-4 accent-brand-500 rounded"
              />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Property type */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-neutral-500 mb-2 block">Property Type</Label>
        <div className="space-y-2">
          {PROP_TYPES.map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={f.property_type.includes(t)}
                onChange={() => toggleArr('property_type', t)}
                className="w-4 h-4 accent-brand-500 rounded"
              />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-neutral-500 mb-2 block">Price Range</Label>
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="Min $"
            value={f.min_price}
            onChange={e => update({ min_price: e.target.value })}
            className="text-xs"
          />
          <Input
            placeholder="Max $"
            value={f.max_price}
            onChange={e => update({ max_price: e.target.value })}
            className="text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {PRICE_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => update({ min_price: p.min, max_price: p.max })}
              className={cn(
                'text-xs px-2 py-1 rounded-full border transition-colors',
                f.min_price === p.min && f.max_price === p.max
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-neutral-200 hover:border-neutral-300',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Beds */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-neutral-500 mb-2 block">Min Bedrooms</Label>
        <div className="flex gap-1">
          <button
            onClick={() => update({ min_beds: '' })}
            className={cn('flex-1 py-1.5 rounded border text-xs transition-colors', !f.min_beds ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-neutral-200 hover:border-neutral-300')}
          >
            Any
          </button>
          {BED_OPTS.map(b => (
            <button
              key={b}
              onClick={() => update({ min_beds: b })}
              className={cn('flex-1 py-1.5 rounded border text-xs transition-colors', f.min_beds === b ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-neutral-200 hover:border-neutral-300')}
            >
              {b}+
            </button>
          ))}
        </div>
      </div>

      {/* Baths */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-neutral-500 mb-2 block">Min Bathrooms</Label>
        <div className="flex gap-1">
          <button
            onClick={() => update({ min_baths: '' })}
            className={cn('flex-1 py-1.5 rounded border text-xs transition-colors', !f.min_baths ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-neutral-200 hover:border-neutral-300')}
          >
            Any
          </button>
          {BATH_OPTS.map(b => (
            <button
              key={b}
              onClick={() => update({ min_baths: b })}
              className={cn('flex-1 py-1.5 rounded border text-xs transition-colors', f.min_baths === b ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-neutral-200 hover:border-neutral-300')}
            >
              {b}+
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-neutral-500 mb-2 block">Sort By</Label>
        <div className="space-y-1">
          {SORT_OPTS.map(o => (
            <label key={o.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sort"
                value={o.value}
                checked={f.sort === o.value}
                onChange={() => update({ sort: o.value })}
                className="accent-brand-500"
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={clearAll} className="w-full">
        <X className="w-3 h-3 mr-1" /> Clear All
      </Button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 shrink-0">
        <div className="bg-white border border-neutral-200 rounded-xl p-5 sticky top-24">
          <p className="font-semibold text-neutral-900 mb-5 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </p>
          {content}
        </div>
      </div>

      {/* Mobile trigger + sheet */}
      <div className="lg:hidden">
        <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)}>
          <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
        </Button>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="relative ml-auto w-80 h-full bg-white overflow-y-auto p-5 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <p className="font-semibold">Filters</p>
                <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
              </div>
              {content}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
