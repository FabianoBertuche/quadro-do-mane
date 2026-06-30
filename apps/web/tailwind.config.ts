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
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#5B5FEF',
          foreground: '#FFFFFF',
          50: '#EEEFFD',
          100: '#D5D6FA',
          200: '#ABAD F5',
          300: '#8184F0',
          400: '#6E72EF',
          500: '#5B5FEF',
          600: '#4347E0',
          700: '#3236C7',
          800: '#272AAE',
          900: '#1C1F95',
        },
        success: { DEFAULT: '#22C55E', foreground: '#FFFFFF' },
        warning: { DEFAULT: '#F59E0B', foreground: '#FFFFFF' },
        error: { DEFAULT: '#EF4444', foreground: '#FFFFFF' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        destructive: { DEFAULT: '#EF4444', foreground: '#FFFFFF' },
        sidebar: {
          DEFAULT: '#0F172A',
          foreground: '#E2E8F0',
          accent: '#1E293B',
          border: '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
