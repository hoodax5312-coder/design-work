const themeColor = (variable) => ({ opacityValue }) => (
  opacityValue === undefined
    ? `var(${variable})`
    : `color-mix(in srgb, transparent, var(${variable}) calc(${opacityValue} * 100%))`
);

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: ['var(--font-pingfang)'],
      serif: ['var(--font-pingfang)'],
      mono: ['var(--font-pingfang)'],
    },
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'max(0px, calc(var(--radius) - 2px))',
        sm: 'max(0px, calc(var(--radius) - 4px))',
      },
      borderColor: {
        DEFAULT: themeColor('--border'),
      },
      colors: {
        neutral: {
          surface: themeColor('--neutral-surface'),
          'surface-subtle': themeColor('--neutral-surface-subtle'),
          foreground: themeColor('--neutral-foreground'),
          border: themeColor('--neutral-border'),
        },
        border: themeColor('--border'),
        input: themeColor('--input'),
        ring: themeColor('--ring'),
        background: themeColor('--background'),
        foreground: themeColor('--foreground'),
        primary: { DEFAULT: themeColor('--primary'), foreground: themeColor('--primary-foreground') },
        secondary: { DEFAULT: themeColor('--secondary'), foreground: themeColor('--secondary-foreground') },
        destructive: { DEFAULT: themeColor('--destructive'), foreground: themeColor('--destructive-foreground') },
        muted: { DEFAULT: themeColor('--muted'), foreground: themeColor('--muted-foreground') },
        accent: { DEFAULT: themeColor('--accent'), foreground: themeColor('--accent-foreground') },
        popover: { DEFAULT: themeColor('--popover'), foreground: themeColor('--popover-foreground') },
        card: { DEFAULT: themeColor('--card'), foreground: themeColor('--card-foreground') },
        sidebar: {
          DEFAULT: themeColor('--sidebar'),
          foreground: themeColor('--sidebar-foreground'),
          primary: themeColor('--sidebar-primary'),
          'primary-foreground': themeColor('--sidebar-primary-foreground'),
          accent: themeColor('--sidebar-accent'),
          'accent-foreground': themeColor('--sidebar-accent-foreground'),
          border: themeColor('--sidebar-border'),
          ring: themeColor('--sidebar-ring'),
        },
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-out': 'slideOut 0.3s ease-out',
        'waveform': 'waveform 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        waveform: {
          '0%, 100%': { height: '10%' },
          '50%': { height: '100%' },
        }
      }
    }
  },
  plugins: [],
}
