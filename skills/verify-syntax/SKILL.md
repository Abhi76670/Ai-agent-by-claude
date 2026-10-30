Verify your own work before you say you are done.
- Re-read every file you wrote: balanced (), {}, [], JSX tags and quotes; every component/variable you use is defined; src/App.jsx defines App; no import/export in the default setup.
- Use the terminal when you can: node --check file.js, python3 -m json.tool package.json, and for JSX: npx --yes esbuild src/App.jsx --log-level=error > /dev/null (silent means valid).
- Flutter: dart analyze. Next.js/Vite: npm run build when dependencies are installed.
- If a check fails, fix the file with <file> and run the check again. In your reply, say what you verified.
