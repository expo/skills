# Storage

## Key-Value Storage

Use the localStorage polyfill for key-value storage. **Never use AsyncStorage**

```tsx
import "expo-sqlite/localStorage/install";

// Simple get/set
localStorage.setItem("key", "value");
localStorage.getItem("key");

// Store objects as JSON
localStorage.setItem("user", JSON.stringify({ name: "John", id: 1 }));
const user = JSON.parse(localStorage.getItem("user") ?? "{}");
```

## When to Use What

| Use Case                                             | Solution                |
| ---------------------------------------------------- | ----------------------- |
| Simple key-value (settings, preferences, small data) | `localStorage` polyfill |
| Large datasets, complex queries, relational data     | Full `expo-sqlite`      |
| Sensitive data (tokens, passwords)                   | `expo-secure-store`     |
| Encrypted, memory-mapped key-value data (dev build)  | `react-native-mmkv`     |

## Storage with React State

Create a storage utility with subscriptions for reactive updates:

```tsx
// utils/storage.ts
import "expo-sqlite/localStorage/install";

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
    listeners.get(key)?.forEach((fn) => fn());
  },

  subscribe(key: string, listener: Listener): () => void {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(listener);
    return () => listeners.get(key)?.delete(listener);
  },
};
```

## React Hook for Storage

```tsx
// hooks/use-storage.ts
import { useSyncExternalStore } from "react";
import { storage } from "@/utils/storage";

export function useStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    (cb) => storage.subscribe(key, cb),
    () => storage.get(key, defaultValue)
  );

  return [value, (newValue: T) => storage.set(key, newValue)];
}
```

Usage:

```tsx
function Settings() {
  const [theme, setTheme] = useStorage("theme", "light");

  return (
    <Switch
      value={theme === "dark"}
      onValueChange={(dark) => setTheme(dark ? "dark" : "light")}
    />
  );
}
```

## Full SQLite for Complex Data

For larger datasets or complex queries, use expo-sqlite directly:

```tsx
import * as SQLite from "expo-sqlite";

const db = await SQLite.openDatabaseAsync("app.db");

// Create table
await db.execAsync(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT
  )
`);

// Insert
await db.runAsync("INSERT INTO events (title, date) VALUES (?, ?)", [
  "Meeting",
  "2024-01-15",
]);

// Query
const events = await db.getAllAsync("SELECT * FROM events WHERE date > ?", [
  "2024-01-01",
]);
```

## MMKV

Use the `localStorage` polyfill when the app runs in Expo Go, or stores simple settings and preferences.

Use `react-native-mmkv` when the app needs:

- Encrypted key-value storage, with AES-128 or AES-256 per instance
- Key-value storage backed by memory-mapped files
- Numbers, booleans, or ArrayBuffers stored without serializing to strings

MMKV requires a development build and does not run in Expo Go. See the [react-native-mmkv docs](https://github.com/margelo/react-native-mmkv).

```bash
npx expo install react-native-mmkv react-native-nitro-modules
```

```tsx
// utils/storage.ts
import { createMMKV } from "react-native-mmkv";

export const storage = createMMKV();

export const secureStorage = createMMKV({
  id: "secure-storage",
  encryptionKey: "hunter2",
  encryptionType: "AES-256",
});
```

Set and get values by type:

```tsx
import { storage } from "@/utils/storage";

storage.set("user.name", "Marc");
storage.set("user.age", 21);
storage.set("user.isPremium", true);

const buffer = new ArrayBuffer(3);
const dataWriter = new Uint8Array(buffer);
dataWriter[0] = 1;
dataWriter[1] = 100;
dataWriter[2] = 255;
storage.set("user.thumbnail", buffer);

const name = storage.getString("user.name");
const age = storage.getNumber("user.age");
const isPremium = storage.getBoolean("user.isPremium");
const thumbnail = storage.getBuffer("user.thumbnail");
```

Hooks re-render when a value changes:

```tsx
import { useMMKVString } from "react-native-mmkv";
import { secureStorage } from "@/utils/storage";

function Profile() {
  const [email, setEmail] = useMMKVString("user.email", secureStorage);
}
```
