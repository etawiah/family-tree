# family-tree-access-requests

Separate Cloudflare Worker that accepts public access requests for https://family-tree.tawiah.net, pages Eugene on Telegram, and on approve adds the email to a Cloudflare Access group.

This Worker is **not** deployed by the main GitHub Action. Routes, secrets, D1, Turnstile, and Access apps are configured in the dashboard. See [docs/ACCESS-REQUESTS.md](../docs/ACCESS-REQUESTS.md).

```bash
npm install
npm test
```
