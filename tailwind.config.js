/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        card: {
          DEFAULT: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
          foreground: '#ffffff',
        },
        border: 'rgba(255, 255, 255, 0.1)', // white/10
        accent: {
          cyan: '#06b6d4',
          purple: '#a855f7',
        }
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
