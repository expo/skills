# Common API Route Patterns

## Authentication Middleware

```ts
// utils/auth.ts
export async function requireAuth(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify token...
  return { userId: "123" };
}

// app/api/protected+api.ts
import { requireAuth } from "../../utils/auth";

export async function GET(request: Request) {
  const { userId } = await requireAuth(request);
  return Response.json({ userId });
}
```

## Proxy External API

```ts
// app/api/weather+api.ts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city");

  const response = await fetch(
    `https://api.weather.com/v1/current?city=${city}&key=${process.env.WEATHER_API_KEY}`
  );

  return Response.json(await response.json());
}
```
