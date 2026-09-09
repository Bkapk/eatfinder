import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Every colour is a CSS variable defined in app/globals.css. Nothing in a
      // component may name a literal hex — that is what keeps a future dark
      // mode a token swap rather than a rewrite.
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        'surface-muted': 'var(--surface-muted)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-soft': 'var(--primary-soft)',
        'on-primary': 'var(--on-primary)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-soft': 'var(--accent-soft)',
        text: 'var(--text)',
        'text-secondary': 'var(--text-secondary)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        success: 'var(--success)',
        'success-hover': 'var(--success-hover)',
        'success-soft': 'var(--success-soft)',
        error: 'var(--error)',
        'error-hover': 'var(--error-hover)',
        'error-soft': 'var(--error-soft)',
        warning: 'var(--warning)',
        'warning-soft': 'var(--warning-soft)',
        info: 'var(--info)',
        'info-hover': 'var(--info-hover)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // A single z-index scale, so the map overlays, the popup and the mobile
      // sheet cannot fight each other.
      zIndex: {
        overlay: '10',
        sticky: '20',
        drawer: '30',
        modal: '50',
      },
    },
  },
  plugins: [],
}
export default config
