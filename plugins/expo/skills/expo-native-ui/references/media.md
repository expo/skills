# Camera, audio, video, and saved media

Read only the API needed, using the installed SDK version:

- [Camera](https://docs.expo.dev/versions/latest/sdk/camera/) and [ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) for capture/selection, permission requirements, and result shapes.
- [Audio](https://docs.expo.dev/versions/latest/sdk/audio/) and [Video](https://docs.expo.dev/versions/latest/sdk/video/) for lifecycle-aware playback/recording. For an existing expo-av migration, use `expo-upgrade` and its focused audio/video reference.
- [MediaLibrary](https://docs.expo.dev/versions/latest/sdk/media-library/) and [FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/) for saving and file ownership. Current and legacy APIs differ; do not mix `/next`, legacy calls, and current imports from examples for different SDKs.

## Integration decisions

Request permissions in the context of a user action that needs them. Distinguish
unresolved, granted, denied, and cannot-ask-again states; offer an appropriate
recovery path. Check whether the selected system picker actually requires broad
library access before requesting it. Request microphone access only for recording
that needs audio, and configure native permission descriptions when required.

Mount only the needed camera, and release/pause resources when the owning screen
loses focus or the app's lifecycle requires it. Wait for camera readiness, prevent
concurrent captures/record starts, handle preparation and save errors, and preserve
a captured result until saving/uploading succeeds. Mirroring a selfie preview and
mirroring the saved photo are separate product decisions.

Keep playback/recording status tied to the actual native object. Define behavior
on navigation, backgrounding, interruption, and headphones disconnecting according
to the feature; do not enable background audio solely because a sample does.

Saving a base64 image may first require writing decoded bytes to a local file with
the correct format and extension. Check the target API's accepted URI types, await
the save, and clean up only temporary files this flow owns. Do not assume a cache
URI is durable storage.

Verify cancellation, permission denial, successful capture/playback, and failed
save/retry on a supported device. Web or simulator success may not cover actual
camera, microphone, library, or background behavior.
