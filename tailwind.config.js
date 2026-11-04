/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Geist"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Geist Mono"', 'monospace'],
      },
      boxShadow: {
        'bento': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 8px 24px -4px rgba(0, 0, 0, 0.04)',
        'bento-hover': '0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 16px 32px -6px rgba(0, 0, 0, 0.08)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
