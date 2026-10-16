# Security

ContextOS is a prototype, not an audited production service. There is no authentication or abuse protection on the backend. CORS only restricts browser behavior; it does not secure a public API or cap Gemini spending.

## Credentials

Keep Gemini keys server-side in environment variables or Secret Manager. Never put keys in Vite environment variables, extension assets, screenshots, recordings, logs, or Git. Use Application Default Credentials on Cloud Run and keep local service-account files outside this checkout. Contributors must supply their own credentials.

Gitignore is a safeguard, not a secret scanner: it cannot protect already tracked files or historical commits. Review the staged diff and run a secret scanner before publishing. If a credential was committed, revoke/rotate it immediately; deleting the current file does not remove it from Git history.

## Data

Knowledge profiles and goals are stored in Chrome local storage. Bridge requests disclose the selected goal and a small set of known concepts to the backend and Gemini. Video manifests may be persisted in Firestore. Do not describe the system as sending no personal context off-device.

## Reporting

Use GitHub private vulnerability reporting on the repository Security tab when available. Otherwise contact the maintainer privately before sharing exploit details. Never attach live credentials to a public issue. No response-time or security-support guarantee is offered for this prototype.
