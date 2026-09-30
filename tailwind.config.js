/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
            colors: {
        'on-primary': '#ffffff',
        'on-primary-container': '#ffffff',
        'on-surface': '#ffffff',
        'on-surface-variant': '#cbd5e1',
        // Material 3 Color Roles
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#38a9f6',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        primary: {
          DEFAULT: '#38a9f6', // md-sys-color-primary
          on: '#ffffff',
          container: '#0284c7',
          'on-container': '#ffffff',
        },
        secondary: {
          DEFAULT: '#64748b',
          on: '#ffffff',
          container: '#334155',
          'on-container': '#f8fafc',
        },
        tertiary: {
          DEFAULT: '#6b5778',
          on: '#ffffff',
          container: '#f2daff',
          'on-container': '#251431',
        },
        error: {
          DEFAULT: '#ffb4ab',
          on: '#690005',
          container: '#93000a',
          'on-container': '#ffdad6',
        },
        accent: {
          DEFAULT: '#e8893d',
          soft: 'color-mix(in srgb, #e8893d 24%, transparent)'
        },
        surface: {
          DEFAULT: 'rgba(38, 70, 115, 0.65)',
          on: '#ffffff',
          variant: 'rgba(25, 45, 80, 0.7)',
          'on-variant': '#cbd5e1',
          container: {
            lowest: 'rgba(15, 23, 42, 0.8)',
            low: 'rgba(30, 41, 59, 0.8)',
            DEFAULT: 'rgba(38, 70, 115, 0.5)',
            high: 'rgba(51, 65, 85, 0.8)',
            highest: 'rgba(71, 85, 105, 0.8)',
          }
        },
        outline: {
          DEFAULT: 'rgba(255, 255, 255, 0.15)',
          variant: 'rgba(255, 255, 255, 0.1)',
        }
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // M3 Typography Scale
        'display-l': ['57px', { lineHeight: '64px', letterSpacing: '-0.25px', fontWeight: '400' }],
        'display-m': ['45px', { lineHeight: '52px', letterSpacing: '0px', fontWeight: '400' }],
        'display-s': ['36px', { lineHeight: '44px', letterSpacing: '0px', fontWeight: '400' }],
        'headline-l': ['32px', { lineHeight: '40px', letterSpacing: '0px', fontWeight: '400' }],
        'headline-m': ['28px', { lineHeight: '36px', letterSpacing: '0px', fontWeight: '400' }],
        'headline-s': ['24px', { lineHeight: '32px', letterSpacing: '0px', fontWeight: '400' }],
        'title-l': ['22px', { lineHeight: '28px', letterSpacing: '0px', fontWeight: '400' }],
        'title-m': ['16px', { lineHeight: '24px', letterSpacing: '0.15px', fontWeight: '500' }],
        'title-s': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
        'label-l': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
        'label-m': ['12px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
        'label-s': ['11px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
        'body-l': ['16px', { lineHeight: '24px', letterSpacing: '0.5px', fontWeight: '400' }],
        'body-m': ['14px', { lineHeight: '20px', letterSpacing: '0.25px', fontWeight: '400' }],
        'body-s': ['12px', { lineHeight: '16px', letterSpacing: '0.4px', fontWeight: '400' }],
      },
      boxShadow: {
        // M3 Elevation (1 to 5)
        'elevation-1': '0px 1px 2px 0px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)',
        'elevation-2': '0px 1px 2px 0px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)',
        'elevation-3': '0px 1px 3px 0px rgba(0,0,0,0.3), 0px 4px 8px 3px rgba(0,0,0,0.15)',
        'elevation-4': '0px 2px 3px 0px rgba(0,0,0,0.3), 0px 6px 10px 4px rgba(0,0,0,0.15)',
        'elevation-5': '0px 4px 4px 0px rgba(0,0,0,0.3), 0px 8px 12px 6px rgba(0,0,0,0.15)',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      }
    },
  },
  plugins: [],
};
