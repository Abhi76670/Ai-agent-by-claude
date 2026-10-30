Identify the framework from the files, then follow its conventions.
- Default setup: src/App.jsx plus src/*.jsx, globals only, no imports.
- Vite/React: package.json has vite, index.html, src/main.jsx, src/App.jsx with import/export.
- Next.js: package.json has next. App Router: app/layout.tsx, app/page.tsx, components/, "use client" for hooks. Pages Router: pages/. Also next.config.js and public/.
- Flutter: pubspec.yaml, lib/main.dart, lib/screens/, lib/widgets/, lib/models/, assets/, test/. Register assets and packages in pubspec.yaml.
- When you add a dependency or asset, update the config file (package.json or pubspec.yaml). Place new files in the matching folder and copy the project's naming and import style.
- Live preview only supports the default setup. For other stacks say so and give the run commands.
