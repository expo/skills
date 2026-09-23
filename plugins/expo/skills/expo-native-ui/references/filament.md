# Filament for Expo

**Use this reference for rendering 3D models (`.glb`/glTF) with physically based lighting.** For procedural geometry, shaders, GPU compute, or Three.js APIs, use `references/webgpu-three.md`.

## Filament vs WebGPU & Three.js

Use `react-native-filament` when the app needs:

- glTF/GLB models with PBR materials, image-based lighting, and shadows
- Skeletal animation and morph targets from the model file
- A native renderer with no JS-side scene graph on the critical path

Use WebGPU and Three.js when the app needs procedural geometry, custom shaders, GPU compute, or the Three.js ecosystem.

Filament requires a development build and does not run in Expo Go or on web.

## Locked Versions (Tested & Working)

```json
{
  "react-native-filament": "~1.11.0",
  "react-native-worklets-core": "~1.6.3"
}
```

Tested on Expo SDK 57 with React Native 0.86.3.

## Installation

```bash
npx expo install react-native-filament react-native-worklets-core
npx expo prebuild
npx expo run:ios
```

The npm package is ~330 MB because it ships native libraries for every architecture. The library adds roughly 4 MB to a built app.

## Babel Configuration

`react-native-filament` compiles its worklets with `react-native-worklets-core`, so add its plugin to `babel.config.js`:

```js
module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [["react-native-worklets-core/plugin", { processNestedWorklets: true }]],
};
```

## Loading a Model

A model source can be a remote URL, a `file://` path, or a bundled asset.

```tsx
import { Camera, DefaultLight, FilamentScene, FilamentView, Model } from "react-native-filament";

const MODEL_URL = "https://example.com/model.glb";

function Scene() {
  return (
    <FilamentView style={{ flex: 1 }}>
      <Camera />
      <DefaultLight />
      <Model source={{ uri: MODEL_URL }} transformToUnitCube />
    </FilamentView>
  );
}

export default function ModelScreen() {
  return (
    <FilamentScene>
      <Scene />
    </FilamentScene>
  );
}
```

`<FilamentScene>` must wrap a child component - hooks and Filament components read its context, so they cannot live in the same component that renders it.

`transformToUnitCube` scales the model to one world unit, which makes camera distances predictable regardless of how the model was exported.

To bundle a local `.glb` instead, add the extension to `metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("glb");

module.exports = config;
```

## Animating and Interacting

**Never pass a shared value to a transform prop (`rotate`, `translate`, `scale`).** It crashes with `EXC_BAD_ACCESS` on iOS and Android - the value's listener is registered in Filament's runtime but invoked on the thread that writes the value, so two threads enter one JS runtime ([#269](https://github.com/margelo/react-native-filament/issues/269)).

Drive animation from a render callback instead. It runs on Filament's own thread each frame, where reading shared values and calling the imperative API is safe.

```tsx
import { RenderCallbackContext, useFilamentContext } from "react-native-filament";
import { useSharedValue } from "react-native-worklets-core";

const SPIN_AXIS: [number, number, number] = [0, 1, 0];

function Spinner({ rootEntity }) {
  const { transformManager } = useFilamentContext();

  RenderCallbackContext.useRenderCallback(
    () => {
      "worklet";
      transformManager.setEntityRotation(rootEntity, Math.PI / 120, SPIN_AXIS, true);
    },
    [transformManager, rootEntity]
  );

  return null;
}
```

`useModel` gives you `rootEntity` once the model is loaded, and `ModelRenderer` draws it:

```tsx
const model = useModel({ uri: MODEL_URL });

<ModelRenderer model={model} transformToUnitCube />;
{model.state === "loaded" && <Spinner rootEntity={model.rootEntity} />}
```

For bones and named nodes, `model.asset.getFirstEntityByName(name)` returns the entity to transform.

## Orbit Camera with Gestures

Handle the gesture on the UI thread, sync it into a worklets-core shared value with `useSyncSharedValue`, and move the camera in the render callback.

```tsx
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  RenderCallbackContext,
  useFilamentContext,
  useSyncSharedValue,
} from "react-native-filament";
import { useSharedValue } from "react-native-reanimated";
import { useSharedValue as useWorkletSharedValue } from "react-native-worklets-core";

const FOCAL_MM = 35;
const ORBIT_RADIUS = 7;
const DRAG_SPEED = 0.008;

function CameraRig({ turn }) {
  const { camera, view } = useFilamentContext();
  const prevAspect = useWorkletSharedValue(0);

  RenderCallbackContext.useRenderCallback(
    () => {
      "worklet";
      const aspect = view.getAspectRatio();
      if (prevAspect.value !== aspect) {
        prevAspect.value = aspect;
        camera.setLensProjection(FOCAL_MM, aspect, 0.1, 100);
      }
      const eye: [number, number, number] = [
        ORBIT_RADIUS * Math.sin(turn.value),
        0,
        ORBIT_RADIUS * Math.cos(turn.value),
      ];
      camera.lookAt(eye, [0, 0, 0], [0, 1, 0]);
    },
    [camera, view, prevAspect, turn]
  );

  return null;
}

function Scene() {
  const animatedTurn = useSharedValue(0);
  const turn = useSyncSharedValue(animatedTurn);

  const pan = Gesture.Pan().onChange((event) => {
    "worklet";
    animatedTurn.value -= event.changeX * DRAG_SPEED;
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>
        <FilamentView style={{ flex: 1 }}>
          <DefaultLight />
          <CameraRig turn={turn} />
          <ModelRenderer model={model} transformToUnitCube />
        </FilamentView>
      </View>
    </GestureDetector>
  );
}
```

A `CameraRig` that sets the lens projection replaces the `<Camera />` component; rendering both means two things fight over the camera.

## Lighting

`<DefaultLight />` is an image-based light plus a directional key light, which is enough to see a model. Replace it for art direction:

```tsx
<EnvironmentalLight source={require("./assets/env_ibl.ktx")} intensity={85_000} />
<Light type="directional" intensity={20_000} colorKelvin={5_200} direction={[-0.15, -0.55, -1]} castShadows />
```

Without any light the scene renders black.

## Common Issues & Solutions

### 1. Crash on animating transform props

`EXC_BAD_ACCESS` / `SIGSEGV` as soon as an animated value updates. Cause and fix above - use a render callback.

### 2. Model is too large or off-screen

Add `transformToUnitCube` and set the camera distance explicitly. With a 35mm lens, a radius of about 7 frames a unit cube.

### 3. Black screen

No light in the scene, or the camera is inside the model. Add `<DefaultLight />` and increase the camera distance.

### 4. Nothing renders and no error appears

`<FilamentScene>` must wrap a child component, not render the scene itself.

### 5. Metro cannot resolve a `.glb` import

Add `glb` to `resolver.assetExts` (see above), then restart Metro with `--clear`.

## Decision Tree

```
Rendering 3D?
├── glTF/GLB model with PBR → react-native-filament
├── Procedural geometry, shaders, GPU compute → WebGPU + Three.js
│
Animating in Filament?
├── Per-frame transforms → RenderCallbackContext.useRenderCallback + transformManager
├── Camera orbit/zoom → same callback + camera.lookAt
├── Model's own clips → useAnimator + applyAnimation
└── NEVER pass shared values to rotate/translate/scale props
```

## Reference

- [Docs](https://margelo.github.io/react-native-filament) and [Camera guide](https://margelo.github.io/react-native-filament/docs/guides/camera)
