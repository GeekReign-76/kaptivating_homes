import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — adjust to match client's preferences
        brand: {
          50:  '#eef4fb',
          100: '#d6e6f5',
          200: '#aeccea',
          300: '#78a7c8',
          400: '#5490d4',
          500: '#3d78c1',  // Karsten's primary blue
          600: '#2e5fa0',
          700: '#274d82',
          800: '#1e3a61',
          900: '#344a66',  // nav dark blue
          950: '#1e2d40',
        },
        // Neutrals — warm off-white to charcoal
        neutral: {
          50:  '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
      },
      fontFamily: {
        sans:  ['var(--font-inter)',     'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)',  'Georgia',   'serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        'slide-in-right':  'slide-in-right 0.3s ease-out',
        'fade-in':         'fade-in 0.2s ease-in',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
