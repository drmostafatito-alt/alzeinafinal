/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // الوضع الليلي يعتمد على كلاس يضعه ConfigProvider على <html>
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--rgb-ink) / <alpha-value>)',
          soft: '#3A3A3A',
          muted: '#6B6B6B',
        },
        rose: {
          DEFAULT: 'rgb(var(--rgb-rose) / <alpha-value>)',
          50: '#FBF3F0',
          100: '#F5E3DD',
          200: '#EBCDC2',
          300: '#DDB4A5',
          400: '#D2A798',
          500: '#C89A8B',
          600: '#B27D6C',
          700: '#916354',
          800: '#6E4B3F',
          900: '#4C332B',
        },
        cream: 'rgb(var(--rgb-cream) / <alpha-value>)',
        blush: 'rgb(var(--rgb-blush) / <alpha-value>)',
        surface: 'rgb(var(--rgb-surface) / <alpha-value>)',

        /* ألوان يتحكم بها المدير بالكامل من لوحة التحكم */
        heading: 'var(--color-heading)',
        body: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        link: 'var(--color-link)',
        'btn-bg': 'var(--color-btn-bg)',
        'btn-text': 'var(--color-btn-text)',
        'btn-hover': 'var(--color-btn-hover-bg)',
        'header-bg': 'var(--color-header-bg)',
        'header-text': 'var(--color-header-text)',
        'topbar-bg': 'var(--color-topbar-bg)',
        'topbar-text': 'var(--color-topbar-text)',
        'footer-bg': 'var(--color-footer-bg)',
        'footer-text': 'var(--color-footer-text)',
        'card-bg': 'var(--color-card-bg)',
        'card-border': 'var(--color-card-border)',
        'brand-border': 'var(--color-border)',
        'section-bg': 'var(--color-section-bg)',
        'hero-bg': 'var(--color-hero-bg)',
        'promo-bg': 'var(--color-promo-bg)',
        'promo-text': 'var(--color-promo-text)',
        price: 'var(--color-price)',
        sale: 'var(--color-sale)',
      },
      fontFamily: {
        ar: ['var(--font-ar)', 'Cairo', 'system-ui', 'sans-serif'],
        en: ['var(--font-en)', 'Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(17,17,17,0.05)',
        card: '0 8px 30px rgba(200,154,139,0.13)',
        lift: '0 18px 45px rgba(17,17,17,0.10)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .5s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        marquee: 'marquee 28s linear infinite',
      },
    },
  },
  plugins: [],
};
