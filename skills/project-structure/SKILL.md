Every folder has one clear purpose.
- src/ app code: App.jsx (root, loaded last), src/components/ reusable UI pieces, src/hooks/ and src/utils/ logic, src/data/ static content, src/styles.css global styles.
- public/ static assets only. make/ extra Makefile parts. Project root: package.json, metadata.json, README.md, Makefile, requirements.md, memory.md.
- One component per file, named after the component. Do not dump everything into App.jsx once it passes about 150 lines.
- Record the structure and each file's job in memory.md.
