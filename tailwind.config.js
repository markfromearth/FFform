/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
          DEFAULT: '#0061a4', // md-sys-color-primary
          on: '#ffffff',
          container: '#d1e4ff',
          'on-container': '#001d36',
        },
        secondary: {
          DEFAULT: '#535f70',
          on: '#ffffff',
          container: '#d7e3f7',
          'on-container': '#101c2b',
        },
        tertiary: {
          DEFAULT: '#6b5778',
          on: '#ffffff',
          container: '#f2daff',
          'on-container': '#251431',
        },
        error: {
          DEFAULT: '#ba1a1a',
          on: '#ffffff',
          container: '#ffdad6',
          'on-container': '#410002',
        },
        surface: {
          DEFAULT: '#fdfcff',
          on: '#1a1c1e',
          variant: '#dfe2eb',
          'on-variant': '#43474e',
          container: {
            lowest: '#ffffff',
            low: '#f7f6f9',
            DEFAULT: '#f1f0f4',
            high: '#ebeaef',
            highest: '#e6e4e9',
          }
        },
        outline: {
          DEFAULT: '#73777f',
          variant: '#c3c7cf',
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
