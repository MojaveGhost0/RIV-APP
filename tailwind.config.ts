import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      spacing: {
        '4.5': '1.125rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      colors: {
        vinotinto: {
          DEFAULT: '#800020',
          light: '#A32947',
          dark: '#590016',
        },
        dorado: {
          DEFAULT: '#D4AF37',
          light: '#E6C96C',
          dark: '#997E25',
        },
        gris: {
          DEFAULT: '#333333',
          claro: '#F3F4F6',
          oscuro: '#1F2937',
        }
      },
    },
  },
  plugins: [],
}
export default config
