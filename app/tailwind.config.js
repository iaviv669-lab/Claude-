/** Tokens live in src/index.css as CSS variables (from replica/design/tokens*.json). */
const c = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: Object.fromEntries(
        ['bg','surface','surface-2','border','border-input','text','muted','accent','on-accent','accent-soft','danger','success','success-soft','warning']
          .map((n) => [n, c(n)])),
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      fontSize: { xs: ['12px', '16px'], sm: ['14px', '20px'], base: ['16px', '24px'], lg: ['20px', '28px'], xl: ['28px', '34px'], display: ['40px', '44px'] },
      borderRadius: { sm: '6px', md: '10px', lg: '16px' },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)', pop: '0 12px 32px rgba(16,24,40,.18)' },
      maxWidth: { app: '560px' },
    },
  },
};
