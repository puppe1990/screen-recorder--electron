/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        panel: '20px',
        control: '12px',
      },
      colors: {
        surface: {
          base: '#09090b',
          raised: '#111113',
          overlay: '#18181b',
          muted: '#27272a',
        },
      },
      boxShadow: {
        panel: '0 16px 48px rgba(0, 0, 0, 0.4)',
        glow: '0 0 20px rgba(129, 140, 248, 0.15)',
      },
    },
  },
  plugins: [],
};
