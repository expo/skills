# WebGPU & Three.js for Expo

**Use this reference for ANY 3D graphics, games, GPU compute, or Three.js features in React Native.** The setup below (version pins, Metro config, canvas shims) is the non-obvious part; scene-building itself is standard Three.js / React Three Fiber.

## Locked Versions (Tested & Working)

```json
{
  "react-native-wgpu": "^0.4.1",
  "three": "0.172.0",
  "@react-three/fiber": "^9.4.0",
  "wgpu-matrix": "^3.0.2",
  "@types/three": "0.172.0"
}
```

**Critical:** These versions are tested together. Mismatched versions cause type errors and runtime issues.

## Installation

```bash
npm install react-native-wgpu@^0.4.1 three@0.172.0 @react-three/fiber@^9.4.0 wgpu-matrix@^3.0.2 @types/three@0.172.0 --legacy-peer-deps
```

`--legacy-peer-deps` may be required due to peer dependency conflicts with canary Expo versions.

## Metro Configuration

Create `metro.config.js` in project root:

```js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force 'three' to webgpu build
  if (moduleName.startsWith("three")) {
    moduleName = "three/webgpu";
  }

  // Use standard react-three/fiber instead of React Native version
  if (platform !== "web" && moduleName.startsWith("@react-three/fiber")) {
    return context.resolveRequest(
      {
        ...context,
        unstable_conditionNames: ["module"],
        mainFields: ["module"],
      },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

## Required Lib Files

Create these files in `src/lib/`:

### 1. make-webgpu-renderer.ts

```ts
import type { NativeCanvas } from "react-native-wgpu";
import * as THREE from "three/webgpu";

export class ReactNativeCanvas {
  constructor(private canvas: NativeCanvas) {}

  get width() {
    return this.canvas.width;
  }
  get height() {
    return this.canvas.height;
  }
  set width(width: number) {
    this.canvas.width = width;
  }
  set height(height: number) {
    this.canvas.height = height;
  }
  get clientWidth() {
    return this.canvas.width;
  }
  get clientHeight() {
    return this.canvas.height;
  }
  set clientWidth(width: number) {
    this.canvas.width = width;
  }
  set clientHeight(height: number) {
    this.canvas.height = height;
  }

  addEventListener(_type: string, _listener: EventListener) {}
  removeEventListener(_type: string, _listener: EventListener) {}
  dispatchEvent(_event: Event) {}
  setPointerCapture() {}
  releasePointerCapture() {}
}

export const makeWebGPURenderer = (
  context: GPUCanvasContext,
  { antialias = true }: { antialias?: boolean } = {}
) =>
  new THREE.WebGPURenderer({
    antialias,
    // @ts-expect-error
    canvas: new ReactNativeCanvas(context.canvas),
    context,
  });
```

### 2. fiber-canvas.tsx

```tsx
import * as THREE from "three/webgpu";
import React, { useEffect, useRef } from "react";
import type { ReconcilerRoot, RootState } from "@react-three/fiber";
import {
  extend,
  createRoot,
  unmountComponentAtNode,
  events,
} from "@react-three/fiber";
import type { ViewProps } from "react-native";
import { PixelRatio } from "react-native";
import { Canvas, type CanvasRef } from "react-native-wgpu";

import {
  makeWebGPURenderer,
  ReactNativeCanvas,
} from "@/lib/make-webgpu-renderer";

// Extend THREE namespace for R3F - add all components you use
extend({
  AmbientLight: THREE.AmbientLight,
  DirectionalLight: THREE.DirectionalLight,
  PointLight: THREE.PointLight,
  SpotLight: THREE.SpotLight,
  Mesh: THREE.Mesh,
  Group: THREE.Group,
  Points: THREE.Points,
  BoxGeometry: THREE.BoxGeometry,
  SphereGeometry: THREE.SphereGeometry,
  CylinderGeometry: THREE.CylinderGeometry,
  ConeGeometry: THREE.ConeGeometry,
  DodecahedronGeometry: THREE.DodecahedronGeometry,
  BufferGeometry: THREE.BufferGeometry,
  BufferAttribute: THREE.BufferAttribute,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  PointsMaterial: THREE.PointsMaterial,
  PerspectiveCamera: THREE.PerspectiveCamera,
  Scene: THREE.Scene,
});

interface FiberCanvasProps {
  children: React.ReactNode;
  style?: ViewProps["style"];
  camera?: THREE.PerspectiveCamera;
  scene?: THREE.Scene;
}

export const FiberCanvas = ({
  children,
  style,
  scene,
  camera,
}: FiberCanvasProps) => {
  const root = useRef<ReconcilerRoot<OffscreenCanvas>>(null!);
  const canvasRef = useRef<CanvasRef>(null);

  useEffect(() => {
    const context = canvasRef.current!.getContext("webgpu")!;
    const renderer = makeWebGPURenderer(context);

    // @ts-expect-error - ReactNativeCanvas wraps native canvas
    const canvas = new ReactNativeCanvas(context.canvas) as HTMLCanvasElement;
    canvas.width = canvas.clientWidth * PixelRatio.get();
    canvas.height = canvas.clientHeight * PixelRatio.get();
    const size = {
      top: 0,
      left: 0,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    };

    if (!root.current) {
      root.current = createRoot(canvas);
    }
    root.current.configure({
      size,
      events,
      scene,
      camera,
      gl: renderer,
      frameloop: "always",
      dpr: 1,
      onCreated: async (state: RootState) => {
        // @ts-expect-error - WebGPU renderer has init method
        await state.gl.init();
        const renderFrame = state.gl.render.bind(state.gl);
        state.gl.render = (s: THREE.Scene, c: THREE.Camera) => {
          renderFrame(s, c);
          context?.present();
        };
      },
    });
    root.current.render(children);
    return () => {
      if (canvas != null) {
        unmountComponentAtNode(canvas!);
      }
    };
  });

  return <Canvas ref={canvasRef} style={style} />;
};
```

## Minimal Scene

Everything inside `FiberCanvas` is standard React Three Fiber:

```tsx
import * as THREE from "three/webgpu";
import { View } from "react-native";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { FiberCanvas } from "@/lib/fiber-canvas";

function RotatingBox() {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    ref.current.rotation.x += delta;
    ref.current.rotation.y += delta * 0.5;
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}

function Scene() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <RotatingBox />
    </>
  );
}

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <FiberCanvas style={{ flex: 1 }}>
        <Scene />
      </FiberCanvas>
    </View>
  );
}
```

Code-split the scene with `React.lazy` + `Suspense` so Three.js does not load at app start.

## Common Issues & Solutions

### 1. "X is not part of the THREE namespace"

**Problem:** Error like `AmbientLight is not part of the THREE namespace`

**Solution:** Add the missing component to the `extend()` call in fiber-canvas.tsx:

```tsx
extend({
  AmbientLight: THREE.AmbientLight,
  // Add other missing components...
});
```

### 2. TypeScript Errors with Three.js

**Problem:** Type mismatches between three.js and R3F

**Solution:** Use `@ts-expect-error` comments where needed:

```tsx
// @ts-expect-error - WebGPU renderer types don't match
await state.gl.init();
```

### 3. Blank Screen

**Problem:** Canvas renders but nothing visible

**Solution:**

1. Ensure camera is positioned correctly and looking at scene
2. Add lighting (objects are black without light)
3. Check that `extend()` includes all components used

### 4. Performance Issues

**Problem:** Low frame rate or stuttering

**Solution:**

- Reduce polygon count in geometries
- Use `useMemo` for static data
- Limit particle count
- Use `instancedMesh` for many identical objects

### 5. Peer Dependency Errors

**Problem:** npm install fails with ERESOLVE

**Solution:** Use `--legacy-peer-deps`:

```bash
npm install <packages> --legacy-peer-deps
```

## Building

WebGPU requires a custom build — it does NOT work in Expo Go:

```bash
npx expo prebuild
npx expo run:ios
```

> Source: https://github.com/wcandillon/react-native-webgpu — the canonical `react-native-wgpu` repo (setup, API, examples). This reference adds only the Expo Metro config, the canvas shims, and the version pins verified to work together.
