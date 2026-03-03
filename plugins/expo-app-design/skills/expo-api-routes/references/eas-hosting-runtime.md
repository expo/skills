# EAS Hosting Runtime (Cloudflare Workers)

API routes run on Cloudflare Workers. Key limitations:

## Missing/Limited APIs

- **No Node.js filesystem** — `fs` module unavailable
- **No native Node modules** — Use Web APIs or polyfills
- **Limited execution time** — 30 second timeout for CPU-intensive tasks
- **No persistent connections** — WebSockets require Durable Objects
- **fetch is available** — Use standard fetch for HTTP requests

## Use Web APIs Instead

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

## Database Options

Since filesystem is unavailable, use cloud databases:

- **Cloudflare D1** — SQLite at the edge
- **Turso** — Distributed SQLite
- **PlanetScale** — Serverless MySQL
- **Supabase** — Postgres with REST API
- **Neon** — Serverless Postgres

Example with Turso:

```ts
// app/api/users+api.ts
import { createClient } from "@libsql/client/web";

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export async function GET() {
  const result = await db.execute("SELECT * FROM users");
  return Response.json(result.rows);
}
```
