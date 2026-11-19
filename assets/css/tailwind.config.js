const themeDir = __dirname + '/../../';
// const defaultTheme = require('tailwindcss/defaultTheme')

const disabledCss = {
    'code::before': false,
    'code::after': false,
    'blockquote p:first-of-type::before': false,
    'blockquote p:last-of-type::after': false,
    pre: false,
    code: false,
    'pre code': false,
    'code::before': false,
    'code::after': false,
}

module.exports = {
    darkMode: 'class',
    content: [
        `${themeDir}/hugo_stats.json`,
    ],
    theme: {
        extend: {
            colors: {
                'primary-bg': '#030712',
                'secondary-bg': '#10141f',
                'tertiary-bg': '#1c2029',
                'primary-text': 'rgb(249, 250, 251)',
                'secondary-text': 'rgb(156, 163, 175)',
                'tertiary-text': '#7734be',
                'primary-border': 'rgba(139, 92, 246, 0.5)',
                'secondary-border': '#1F2937'
            },
            spacing: {
                '25': '6.25rem',
                '50': '12.5rem',
            },
            typography: {
                DEFAULT: { css: disabledCss },
                base: { css: disabledCss },
                sm: { css: disabledCss },
                lg: { css: disabledCss },
                xl: { css: disabledCss },
                '2xl': { css: disabledCss },
            },
            backgroundImage: {
                'hero-pattern': "url('/hero-pattern.svg')",
            },
            fontFamily: {
                'sans': ['ui-sans-serif', 'system-ui', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
                'display': ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                'geist-mono': ['"Geist Mono"', 'ui-monospace', 'monospace'],
            },
            keyframes: {
                marquee: {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-50%)' },
                },
                'word-in': {
                    from: { opacity: '0', transform: 'translateY(0.35em)', filter: 'blur(6px)' },
                    to: { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
                },
                'fade-up': {
                    from: { opacity: '0', transform: 'translateY(16px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                float: {
                    '0%, 100%': { transform: 'translate(0, 0)' },
                    '50%': { transform: 'translate(3px, -6px)' },
                },
            },
            animation: {
                marquee: 'marquee 45s linear infinite',
                'word-in': 'word-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
                'fade-up': 'fade-up 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
                float: 'float 6s ease-in-out infinite',
            }
        },
    },
    variants: {},
    plugins: [require('@tailwindcss/typography'),]
}