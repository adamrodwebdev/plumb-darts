# Security

Plumb is a static page: no server code, no forms that send data, no accounts, no third-party
requests. Each page carries a Content Security Policy in a meta tag (GitHub Pages cannot send
headers) that allows only the site's own files and its inline blocks by hash.

To report a problem, open an issue or write through the contact on
https://github.com/adamrodwebdev.

## Dependency advisories

`npm audit` (dev dependencies included) is read before every publication.

| Advisory | Severity | Where | Status |
|---|---|---|---|
| minimatch, GHSA-g3hv-75wg-m249 (denial of service through glob patterns) | moderate | dev tooling only (ESLint and typescript-eslint); nothing shipped | **awaiting the user's decision** before v1.0; same case the user accepted for Skull Darts 71 on 2026-11-05 |
