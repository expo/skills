# Add the mascot to an Expo screen

Use the exported `.riv` and the exact artboard and state-machine names from `rive inspect`. Locate the requested screen in the app's existing navigation and mount the mascot there.

1. Use the app's installed `@rive-app/react-native` version. If the runtime is missing, install it and its compatible Nitro Modules dependency using the [Rive Expo setup guide](https://rive.app/docs/runtimes/react-native/adding-rive-to-expo). Build a native development client after adding or changing those native dependencies.
2. For a bundled asset, put the `.riv` in the app and add `riv` to the existing Metro config's `resolver.assetExts` if it is missing. Keep the app's other Metro settings and restart Metro after changing the config.
3. Load the asset with `useRiveFile(require('./path/to/mascot.riv'))` using the file's actual path relative to the component. Handle loading and errors using the screen's existing UI. Mount a sized `RiveView` with the loaded `file`, exact `artboardName` and `stateMachineName`, and `autoPlay` for a mascot that plays on screen entry. Keep the existing View Model binding when the screen also swaps outfits.
4. Open the requested screen in the native development build. Watch the mascot play the intended motion from the start through its return to idle or a full loop. Record the route, platform, and what played. If you could only verify bundling, report device playback as unverified.

See [Customizing Metro](https://docs.expo.dev/guides/customizing-metro/#adding-more-file-extensions-to-assetexts) and [Loading Rive files](https://rive.app/docs/runtimes/react-native/loading-rive-files).
