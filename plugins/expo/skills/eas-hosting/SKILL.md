---
name: eas-hosting
description: EAS service (paid). Deploy Expo websites and Expo Router API routes to EAS Hosting - export the web bundle, run eas deploy for production and PR preview URLs, manage environment secrets and custom domains, and work within the Cloudflare Workers runtime. Also covers authoring API routes (+api.ts handlers, HTTP methods, request handling, CORS). Use when deploying an Expo web app or API routes, setting up EAS Hosting, or configuring hosting environments and domains. Not for native builds or store releases - use the eas-app-stores skill for those.
version: 1.0.0
license: MIT
---

# EAS Hosting

> **EAS service - costs apply.** EAS Hosting is a paid Expo Application Services product with free-tier limits; production deploys use your plan's request and bandwidth allowance. See https://expo.dev/pricing. Authoring API routes and exporting the web bundle are free and open source, and you can self-host the exported server output instead of EAS Hosting.

EAS Hosting deploys your Expo **web app and API routes** to Expo's managed edge (Cloudflare Workers). Export the web bundle with `npx expo export -p web` and ship it with `eas deploy` - the same command deploys any Expo Router API routes bundled alongside it.

## When to Use API Routes

Use API routes when you need:

- **Server-side secrets** — API keys, database credentials, or tokens that must never reach the client
- **Database operations** — Direct database queries that shouldn't be exposed
- **Third-party API proxies** — Hide API keys when calling external services (OpenAI, Stripe, etc.)
- **Server-side validation** — Validate data before database writes
- **Webhook endpoints** — Receive callbacks from services like Stripe or GitHub
- **Rate limiting** — Control access at the server level
- **Heavy computation** — Offload processing that would be slow on mobile

## When NOT to Use API Routes

Avoid API routes when:

- **Data is already public** — Use direct fetch to public APIs instead
- **No secrets required** — Static data or client-safe operations
- **Real-time updates needed** — Use WebSockets or services like Supabase Realtime
- **Simple CRUD** — Consider Firebase, Supabase, or Convex for managed backends
- **File uploads** — Use direct-to-storage uploads (S3 presigned URLs, Cloudflare R2)
- **Authentication only** — Use Clerk, Auth0, or Firebase Auth instead

## Authoring API Routes

API routes are files in the `app` directory with a `+api.ts` suffix. Export one named function per HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`); handlers take and return standard `Request`/`Response`, and dynamic segments arrive as the second argument:

```ts
// app/api/users/[id]+api.ts → /api/users/:id
export async function GET(request: Request, { id }: { id: string }) {
  return Response.json({ id });
}
```

Secrets: `process.env` is server-only. Set values locally in `.env` (never commit); on EAS Hosting use `eas env:create` or the Expo dashboard.

> **Source of truth:** https://docs.expo.dev/router/web/api-routes/ — consult the canonical docs when API details matter (request/query/body handling, errors, and local testing with `npx expo serve`). CORS and response headers: https://docs.expo.dev/eas/hosting/reference/responses-and-headers/ — EAS Hosting auto-answers unhandled `OPTIONS` requests with permissive CORS, so most APIs need no manual CORS code.

## Deployment

```bash
npm install -g eas-cli && eas login   # once

npx expo export -p web                # 1. export web bundle + API routes (required first)
npx eas-cli@latest deploy             # 2. preview deploy (PR-style URL)
npx eas-cli@latest deploy --prod      # 3. production
```

The export runs whether you have a full website, an API-routes-only backend, or both; `eas deploy` ships whatever `npx expo export -p web` produced.

- **Production secrets:** `eas env:create --name OPENAI_API_KEY --value sk-xxx --environment production` (or the Expo dashboard).
- **Custom domain:** configure in `eas.json` or the Expo dashboard.
- **Deploy on push/PR (CI):** use `type: deploy` EAS Workflows jobs — see the `eas-workflows` skill.
- **`.well-known` files** (`apple-app-site-association`, `assetlinks.json`): place them in `public/.well-known/` and they deploy as static files. See https://docs.expo.dev/linking/ios-universal-links/ and the sibling `expo-app-clip` skill for the full AASA flow.

## EAS Hosting Runtime (Cloudflare Workers)

API routes run on Cloudflare Workers. Key limitations:

- **No persistent filesystem** — `node:fs` exists only as an in-memory shim; use a hosted database instead (Cloudflare D1, Turso, PlanetScale, Supabase, Neon)
- **No native Node modules** — Use Web APIs or polyfills
- **Limited execution time** — 30 second timeout for CPU-intensive tasks
- **No persistent connections** — WebSockets require Durable Objects
- **fetch is available** — Use standard fetch for HTTP requests

Use Web APIs instead of Node equivalents:

```ts
// Use Web Crypto instead of Node crypto
const hash = await crypto.subtle.digest(
  "SHA-256",
  new TextEncoder().encode("data")
);

// Use fetch instead of node-fetch
const response = await fetch("https://api.example.com");

// Use Response/Request (already available)
return new Response(JSON.stringify(data), {
  headers: { "Content-Type": "application/json" },
});
```

> **Source of truth:** https://docs.expo.dev/eas/hosting/reference/worker-runtime/ — consult the canonical docs when runtime details matter (available globals and Node compatibility).

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-hosting" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
