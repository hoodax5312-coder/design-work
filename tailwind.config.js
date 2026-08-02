/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: ['PingFang SC', 'PingFang TC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', 'Arial', 'sans-serif'],
      serif: ['PingFang SC', 'PingFang TC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['PingFang SC', 'PingFang TC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', 'Arial', 'sans-serif'],
    },
    extend: {
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))', cyan: '#c8ff00', purple: '#c8ff00' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
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
