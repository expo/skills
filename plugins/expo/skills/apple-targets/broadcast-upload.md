---
title: Broadcast Upload Extension
description: Receives screen recording video and audio sample buffers from ReplayKit and uploads them to a live streaming service.
version: iOS 10.0+, tvOS 10.0+, macOS 11.0+
---

# Broadcast Upload Extension (`broadcast-upload`)

An extension that receives live screen capture data -- video frames, app audio, and microphone audio -- from ReplayKit and streams it to a remote broadcast service. The system delivers `CMSampleBuffer` objects to your extension process in real time, and your code encodes and uploads them. This is the engine behind live streaming features in apps like Twitch, YouTube Live, and game streaming platforms.

## Apple Documentation

- [ReplayKit Framework](https://developer.apple.com/documentation/replaykit)
- [RPBroadcastSampleHandler](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler)
- [processSampleBuffer(_:with:)](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler/processsamplebuffer(_:with:))
- [broadcastStarted(withSetupInfo:)](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler/broadcaststarted(withsetupinfo:))
- [broadcastFinished()](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler/broadcastfinished())
- [finishBroadcastWithError(_:)](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler/finishbroadcastwitherror(_:))
- [RPSampleBufferType](https://developer.apple.com/documentation/replaykit/rpsamplebuffertype)

## WWDC History

- **[WWDC 2016, Session 601 -- Go Live with ReplayKit](https://developer.apple.com/videos/play/wwdc2016/601/)** -- Introduced broadcast extensions (setup UI + upload). Demonstrated live game streaming with a Mobcrush extension.
- **[WWDC 2017, Session 606 -- What's New with Screen Recording and Live Broadcast](https://developer.apple.com/videos/play/wwdc2017/606/)** -- Added in-app camera overlay support and refined the broadcast upload API.
- **[WWDC 2018, Session 601 -- Live Screen Broadcast with ReplayKit](https://developer.apple.com/videos/play/wwdc2018/601/)** -- Introduced system-wide broadcast from Control Center (ReplayKit 2), `RPSystemBroadcastPickerView`, and best practices for handling account sign-in in broadcast extensions.
- **[WWDC 2020, Session 10633 -- Capture and Stream Apps on the Mac with ReplayKit](https://developer.apple.com/videos/play/wwdc2020/10633/)** -- Brought ReplayKit broadcast extensions to macOS, including Mac Catalyst support.

## What It Does

1. The user initiates a broadcast via Control Center, `RPSystemBroadcastPickerView`, or `RPBroadcastActivityViewController`.
2. The system launches the broadcast upload extension process and calls `broadcastStarted(withSetupInfo:)` with any configuration from the paired setup UI extension.
3. ReplayKit continuously delivers `CMSampleBuffer` objects to `processSampleBuffer(_:with:)` with one of three types: `.video` (screen frames), `.audioApp` (system/app audio), and `.audioMic` (microphone input).
4. Your extension encodes the buffers and uploads them to your streaming backend over a socket or HTTP connection.
5. When the user stops the broadcast, the system calls `broadcastFinished()`. Your extension flushes remaining data and tears down the connection.
6. If a fatal error occurs, your extension calls `finishBroadcastWithError(_:)` to surface a message to the user and terminate the session.

## Use Cases

### Game Live Streaming

A gaming platform (Twitch, YouTube Gaming, Facebook Gaming) provides a broadcast upload extension so players can stream gameplay directly from any iOS game without third-party capture hardware.

### Video Conferencing Screen Sharing

Apps like Zoom, Teams, or WebEx use a broadcast upload extension to share the entire screen during a call. The extension captures screen content and sends it to the conferencing server via WebRTC or a proprietary protocol.

### Remote Support and Collaboration

Enterprise remote-assistance apps stream the user's screen to a support agent. The broadcast upload extension captures the display while the main app handles the bidirectional communication channel.

### Educational Broadcasting

An instructor streams their iPad screen to students via a custom LMS. The extension uploads the screen capture to a media server, and students view it through a companion app or web player.

## Key Classes

| Class | Role |
|-------|------|
| `RPBroadcastSampleHandler` | Subclass this. Receives lifecycle callbacks and sample buffers for the broadcast session. |
| `CMSampleBuffer` | Core Media buffer containing a video frame or audio samples delivered by ReplayKit. |
| `RPSampleBufferType` | Enum distinguishing `.video`, `.audioApp`, and `.audioMic` buffers. |
| `RPSystemBroadcastPickerView` | UIView (iOS 12+) that displays a system picker button to start a broadcast from within your app. |
| `RPBroadcastActivityViewController` | View controller that presents a list of available broadcast services (pre-iOS 12 flow). |

## Implementation

### RTMP-Style Streaming Handler

A realistic broadcast upload extension that connects to an RTMP-style streaming server, encodes video frames, mixes audio, and handles lifecycle events:

```swift
import ReplayKit
import VideoToolbox

class SampleHandler: RPBroadcastSampleHandler {

    private var socketConnection: StreamSocketConnection?
    private var videoEncoder: H264Encoder?
    private var audioMixer: AudioSampleMixer?
    private var isBroadcasting = false

    // 1. Called when the user starts the broadcast. Set up your upload pipeline.
    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        // Extract server URL and stream key from setup info (provided by the setup UI extension)
        let serverURL = setupInfo?["serverURL"] as? String ?? "rtmp://live.example.com/stream"
        let streamKey = setupInfo?["streamKey"] as? String ?? ""

        // 2. Initialize the socket connection to the streaming server
        socketConnection = StreamSocketConnection(url: serverURL, key: streamKey)
        socketConnection?.onError = { [weak self] error in
            // Surface connection errors to the user
            self?.finishBroadcastWithError(NSError(
                domain: "com.example.broadcast",
                code: -1,
                userInfo: [NSLocalizedFailureReasonErrorKey: "Lost connection to server: \(error.localizedDescription)"]
            ))
        }
        socketConnection?.connect()

        // 3. Set up hardware-accelerated H.264 encoding.
        //    Downscale to 720p to stay within the 50MB memory limit.
        videoEncoder = H264Encoder(
            width: 1280,
            height: 720,
            bitrate: 3_000_000,
            keyFrameInterval: 2
        )
        videoEncoder?.onEncodedFrame = { [weak self] nalUnits, presentationTime in
            self?.socketConnection?.sendVideo(nalUnits, timestamp: presentationTime)
        }

        // 4. Set up audio mixing (app audio + mic audio into a single AAC stream)
        audioMixer = AudioSampleMixer(sampleRate: 44100, channels: 2)
        audioMixer?.onMixedSamples = { [weak self] aacData, presentationTime in
            self?.socketConnection?.sendAudio(aacData, timestamp: presentationTime)
        }

        isBroadcasting = true
    }

    // 5. Called for every video frame and audio chunk. This is the hot path.
    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard isBroadcasting else { return }

        switch sampleBufferType {
        case .video:
            // 6. Encode the video frame. The encoder downscales and compresses
            //    using VideoToolbox hardware acceleration.
            videoEncoder?.encode(sampleBuffer)

        case .audioApp:
            // 7. Feed app audio into the mixer
            audioMixer?.appendAppAudio(sampleBuffer)

        case .audioMic:
            // 8. Feed microphone audio into the mixer
            audioMixer?.appendMicAudio(sampleBuffer)

        @unknown default:
            break
        }
    }

    // 9. Called when the broadcast is paused (e.g., phone call interruption)
    override func broadcastPaused() {
        audioMixer?.pause()
        videoEncoder?.pause()
    }

    // 10. Called when the broadcast resumes after a pause
    override func broadcastResumed() {
        audioMixer?.resume()
        videoEncoder?.resume()
    }

    // 11. Called when the user stops the broadcast. Flush buffers and disconnect.
    override func broadcastFinished() {
        isBroadcasting = false
        videoEncoder?.flush()
        audioMixer?.flush()
        socketConnection?.disconnect()

        videoEncoder = nil
        audioMixer = nil
        socketConnection = nil
    }
}
```

### Minimal Sample Buffer Logger (Debugging)

Useful for verifying your extension receives data before building the full upload pipeline:

```swift
import ReplayKit

class SampleHandler: RPBroadcastSampleHandler {

    private var frameCount = 0

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        frameCount = 0
        NSLog("[BroadcastUpload] Broadcast started. Setup info: \(setupInfo ?? [:])")
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        switch sampleBufferType {
        case .video:
            frameCount += 1
            if frameCount % 60 == 0 {
                // 1. Log every 60th frame to avoid flooding the console
                let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                NSLog("[BroadcastUpload] Video frame #\(frameCount), PTS: \(timestamp.seconds)")
            }
        case .audioApp:
            break // App audio received
        case .audioMic:
            break // Mic audio received
        @unknown default:
            break
        }
    }

    override func broadcastFinished() {
        NSLog("[BroadcastUpload] Broadcast finished. Total video frames: \(frameCount)")
    }
}
```

## Usage

- Create: `bun create target broadcast-upload`
- Edit: `targets/broadcast-upload/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 10.0+ | Full support. System-wide broadcast added in iOS 11. |
| iPadOS | 10.0+ | Full support. Larger screen sizes increase memory pressure. |
| macOS | 11.0+ | Supported via Mac Catalyst and native macOS apps. |
| tvOS | 10.0+ | Supported for in-app broadcasts only (no Control Center picker). |
| visionOS | -- | Not supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **50MB memory limit.** The extension process is killed if it exceeds 50MB of RAM. ReplayKit itself can consume 20-25MB of that budget for internal buffers, leaving your code with roughly 25MB. Downscale video frames and use hardware-accelerated H.264 (not VP8) to stay under the limit.
- **iPad screen sizes spike memory.** ReplayKit delivers pixel buffers at the native screen resolution. On iPad Pro (2732x2048), uncompressed frames are significantly larger than iPhone frames. Always downscale before encoding.
- **App switching causes memory spikes.** When the user presses the home button or switches apps during a system broadcast, ReplayKit may queue up to 6-8 unprocessed buffers simultaneously, causing a temporary memory spike that can push you over the 50MB limit even if your steady-state usage is well under it.
- **No direct access to the broadcast state.** The extension process is separate from your main app. Use App Groups and shared `UserDefaults` or a shared file to communicate state (stream key, authentication tokens) between your app and the extension.
- **`finishBroadcastWithError` is your only error UI.** The extension has no visible interface. The only way to communicate errors to the user is through the localized failure reason in the `NSError` you pass to `finishBroadcastWithError(_:)`.
- **Audio buffers arrive on a different cadence than video.** Do not assume audio and video buffers are interleaved 1:1. Audio buffers arrive more frequently and in smaller chunks. Your encoder/muxer must handle independent timing.
- **`RPBroadcastProcessMode` must be set in Info.plist.** The extension's Info.plist must include `RPBroadcastProcessMode` set to `RPBroadcastProcessModeSampleBuffer`. Without this, the system may not deliver sample buffers to your handler. The `@bacons/apple-targets` plugin sets this automatically.
