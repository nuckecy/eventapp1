// Tailwind CSS v4 PostCSS plugin. v4 dropped the autoprefixer step
// and replaced the v3 config-file approach with a CSS-first
// (`@theme`) workflow — see app/globals.css.

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
