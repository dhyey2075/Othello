/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0b0d10',
          900: '#111418',
          850: '#161a1f',
          800: '#1c2127',
          700: '#262c34',
          600: '#343b45',
          500: '#4b5461',
          400: '#6b7482',
          300: '#98a0ac',
          200: '#c4c9d0',
          100: '#e6e8eb',
        },
        accent: {
          DEFAULT: '#f2b84b',
          soft: '#f6cd7c',
          deep: '#c98d1f',
        },
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(242,184,75,0.35), 0 8px 28px -8px rgba(242,184,75,0.35)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2,0.6,0.3,1) infinite',
      },
    },
  },
  plugins: [],
};
