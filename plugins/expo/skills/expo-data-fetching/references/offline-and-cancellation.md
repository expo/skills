# Offline Support & Request Cancellation

Companion reference for `expo-data-fetching`.

## Offline Support

**Check network status**:

```tsx
import NetInfo from "@react-native-community/netinfo";

// Hook for network status
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
  }, []);

  return isOnline;
}
```

**Offline-first with React Query**:

```tsx
import { onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

// Sync React Query with network status
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(state.isConnected ?? true);
  });
});

// Queries will pause when offline and resume when online
```

## Request Cancellation

**Cancel on unmount**:

```tsx
useEffect(() => {
  const controller = new AbortController();

  fetch(url, { signal: controller.signal })
    .then((response) => response.json())
    .then(setData)
    .catch((error) => {
      if (error.name !== "AbortError") {
        setError(error);
      }
    });

  return () => controller.abort();
}, [url]);
```

**With React Query:** pass the query function's signal to the request. Unused
queries are not cancelled by default if the request does not consume the signal.

```tsx
const query = useQuery({
  queryKey: ["user", userId],
  queryFn: async ({ signal }) => {
    const response = await fetch(`${API_URL}/users/${userId}`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
});
```

See [TanStack Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
