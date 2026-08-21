/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta própria: azul-petróleo profundo (confiança clínica) + verde-menta (saúde/crescimento)
        // como accent de ações positivas, e âmbar só para alertas/pendências de aprovação.
        base: {
          950: '#0b1220',
          900: '#0f172a',
          800: '#16213a',
          700: '#1f2d4d'
        },
        ink: {
          100: '#eef2f8',
          300: '#b6c2d9',
          500: '#7c8aa8'
        },
        mint: {
          400: '#4fd1ae',
          500: '#2fb894',
          600: '#219677'
        },
        amber: {
          400: '#f2b84b'
        }
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif']
      }
    }
  },
  plugins: []
};
