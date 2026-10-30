Security rules for everything you write or run.
- Never hardcode secrets (API keys, tokens, passwords) in generated code. Use placeholders, list names in .env.example, add .env to .gitignore. Never print env vars.
- No eval(), new Function(), dangerouslySetInnerHTML or inline event strings. Validate and trim all user input before using it.
- Links with target="_blank" need rel="noopener noreferrer". Use https. Pin CDN versions and use only well-known CDNs.
- Do not store passwords or sensitive personal data in localStorage.
- Terminal: run only what the task needs. Never run rm -rf, sudo, curl|bash, or anything outside the project folder.
