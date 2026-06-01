import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ms: {
          blue: '#0078d4',
          green: '#107c10',
          red: '#d13438',
          orange: '#ca5010',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
