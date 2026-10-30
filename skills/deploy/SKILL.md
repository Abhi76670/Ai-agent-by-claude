Files a deployable project needs.
- package.json: name, version, scripts (start, build, check), pinned dependencies.
- metadata.json: {"name","description","prompt"} describing the app.
- README.md: what it is, install, run, deploy. .env.example: variable names only. .gitignore: node_modules, .env, build output.
- Makefile with targets run, check, build, clean, deploy; large projects split extra targets into make/*.mk files pulled in with include make/*.mk.
- Deploy: static hosting (Netlify, Vercel, GitHub Pages) for the default setup, Vercel for Next.js, flutter build web for Flutter.
