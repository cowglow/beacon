import { defineConfig } from 'vite'

// GitHub Pages project sites are served from /<repo-name>/, not the domain
// root. The deploy workflow sets BASE_PATH to the actual repo name at build
// time; local dev/build default to root.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
})
