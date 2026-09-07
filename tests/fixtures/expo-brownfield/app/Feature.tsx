import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from 'react-native';
import * as Brownfield from 'expo-brownfield';

export default function Feature({ requestId, userId, greeting: initialGreeting }: {
  requestId: string; userId: string; greeting: string;
}) {
  const [greeting, setGreeting] = useState(initialGreeting);

  useEffect(() => {
    const subscription = Brownfield.addMessageListener((event) => {
      if (event.requestId === requestId && event.type === 'feature.context') {
        setGreeting(String(event.greeting));
      }
    });
    return () => subscription.remove();
  }, [requestId]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>{greeting}: {userId}</Text>
      <Image accessibilityLabel="Bundled Expo image" source={require("./assets/icon.png")} style={{ width: 48, height: 48 }} />
      <Button title="Refresh greeting" onPress={() => Brownfield.sendMessage({ type: "feature.request-context", requestId })} />
      <Button title="Done" onPress={() => Brownfield.sendMessage({
        type: 'feature.completed', requestId, selectedId: 'item-42',
      })} />
      <Button title="Native dismiss API" onPress={() => Brownfield.popToNative(true)} />
      <Button title="Cancel" onPress={() => Brownfield.sendMessage({
        type: 'feature.cancelled', requestId,
      })} />
    </View>
  );
}
