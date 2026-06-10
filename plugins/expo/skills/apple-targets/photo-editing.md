---
title: Photo Editing Extension
description: Adds custom editing tools directly inside the Photos app, allowing users to apply filters, adjustments, and markup without leaving their library.
version: iOS 8.0+, macOS 10.11+
---

# Photo Editing Extension (`photo-editing`)

An extension that integrates custom image and video editing tools into the system Photos app. When a user taps Edit on a photo and selects your extension from the action menu, the Photos app hands your view controller the asset as a `PHContentEditingInput` along with a placeholder image. Your UI applies edits -- filters, crops, overlays, markup -- and returns a `PHContentEditingOutput` containing the rendered result and a `PHAdjustmentData` blob that encodes the edit recipe. Because Photos always preserves the original asset, your edits are non-destructive: the user can reopen your extension later, and if your `canHandle(_:)` method recognizes the adjustment data, you can reconstruct the previous edit state and let them modify or revert changes.

## Apple Documentation

- [Creating Photo Editing Extensions](https://developer.apple.com/documentation/photokit/creating-photo-editing-extensions)
- [PHContentEditingController Protocol](https://developer.apple.com/documentation/photokit/phcontenteditingcontroller)
- [PHContentEditingInput](https://developer.apple.com/documentation/photokit/phcontenteditinginput)
- [PHContentEditingOutput](https://developer.apple.com/documentation/photokit/phcontenteditingoutput)
- [PHAdjustmentData](https://developer.apple.com/documentation/photokit/phadjustmentdata)
- [App Extension Programming Guide -- Photo Editing](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Photos.html)
- [Sample Photo Editing Extension (Apple Archive)](https://developer.apple.com/library/archive/samplecode/SamplePhotoEditingExtension/Introduction/Intro.html)

## WWDC History

- **[WWDC 2014, Session 511 -- Introducing the Photos Frameworks](https://developer.apple.com/videos/play/wwdc2014/511/)** -- Introduced PhotoKit and the Photo Editing extension point. Demonstrated how `PHContentEditingController` integrates third-party editing into the Photos app with non-destructive adjustment data.
- **[WWDC 2014, Session 514 -- Advances in Core Image](https://developer.apple.com/videos/play/wwdc2014/514/)** -- Showed how custom `CIKernel` and `CIFilter` subclasses can be used inside Photo Editing extensions for GPU-accelerated image processing.
- **[WWDC 2014, Session 217 -- Creating Extensions for iOS and OS X, Part 2](https://developer.apple.com/videos/play/wwdc2014/217/)** -- Covered the broader app extensions architecture that Photo Editing extensions are built on, including lifecycle and memory management.
- **[WWDC 2018, Session 505 -- Integrating with Photos on macOS](https://developer.apple.com/videos/play/wwdc2018/505/)** -- Covered macOS-specific Photo Editing extension integration and the unified Photos experience across platforms.

## What It Does

1. The user opens a photo or video in the Photos app and taps Edit.
2. The user taps the extensions button (the ellipsis icon) and selects your extension from the activity list.
3. Photos calls `canHandle(_:)` with the existing `PHAdjustmentData` (if any previous edit was made). If you return `true`, Photos provides the original, unmodified asset so you can reconstruct the prior edit state. If you return `false`, Photos provides the already-rendered version.
4. Photos calls `startContentEditing(with:placeholderImage:)`, passing a `PHContentEditingInput` (containing the full-size image URL or video AVAsset) and a `UIImage` placeholder for immediate display.
5. Your view controller presents editing controls. The user applies filters, adjustments, or markup.
6. When the user taps Done, Photos calls `finishContentEditing(completionHandler:)`. You render the final image, create a `PHContentEditingOutput` with the rendered JPEG written to `output.renderedContentURL`, and attach a `PHAdjustmentData` object encoding your edit parameters.
7. Photos stores the output alongside the original. The edit is non-destructive -- the user can revert to the original at any time.
8. If the user taps Cancel, Photos calls `cancelContentEditing()` and your extension cleans up any temporary files.

## Use Cases

### Filter and Effects Apps

A photo filter app (VSCO, Snapseed-style) exposes its filter library directly inside Photos. Users apply a look, adjust intensity, and save -- all without leaving the Photos app. The `PHAdjustmentData` stores the filter name and parameter values so users can re-edit later.

### Markup and Annotation Tools

A markup tool adds text, arrows, shapes, and freehand drawings on top of photos. The adjustment data serializes each annotation's position, style, and content, enabling full round-trip editing.

### Professional Retouching

A portrait retouching extension provides skin smoothing, blemish removal, and lighting adjustments. Because it receives the full-resolution image via `PHContentEditingInput.fullSizeImageURL`, it can operate at the native camera resolution.

### Batch Watermarking

A business or photographer's extension applies a watermark overlay with customizable position, opacity, and text. The simple parameter set makes `PHAdjustmentData` round-trips straightforward.

## Key Classes

| Class / Protocol | Role |
|-------|------|
| `PHContentEditingController` | Protocol your `UIViewController` adopts. Provides the lifecycle methods: `canHandle`, `startContentEditing`, `finishContentEditing`, `cancelContentEditing`. |
| `PHContentEditingInput` | Describes the asset being edited. Provides `fullSizeImageURL`, `displaySizeImage`, `avAsset` (for video), and existing `adjustmentData`. |
| `PHContentEditingOutput` | Container for your edited result. Write the rendered JPEG/video to `renderedContentURL` and attach `adjustmentData`. |
| `PHAdjustmentData` | Encodes your edit recipe as a `Data` blob with a `formatIdentifier` (reverse-DNS) and `formatVersion` (semantic versioning recommended). Enables non-destructive round-trip editing. |
| `CIFilter` / `CIContext` | Core Image classes commonly used to apply GPU-accelerated filters to the full-size image inside the extension. |

## Implementation

### Core Image Filter Extension with Adjustment Data Round-Trip

A realistic photo editing extension that applies a sepia + vignette filter chain, serializes the parameters into `PHAdjustmentData`, and supports re-editing previous sessions:

```swift
import UIKit
import Photos
import PhotosUI

class PhotoEditingViewController: UIViewController, PHContentEditingController {

    // 1. Define a stable format identifier and version for adjustment data.
    //    Use reverse-DNS and semantic versioning so you can evolve the format.
    private static let formatIdentifier = "com.example.photo-editing"
    private static let formatVersion = "1.0"

    private var input: PHContentEditingInput?
    private let imageView = UIImageView()
    private let intensitySlider = UISlider()
    private let ciContext = CIContext()

    // 2. Track the current filter intensity (0.0 to 1.0)
    private var filterIntensity: Float = 0.5

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        imageView.contentMode = .scaleAspectFit
        imageView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(imageView)

        intensitySlider.minimumValue = 0.0
        intensitySlider.maximumValue = 1.0
        intensitySlider.value = filterIntensity
        intensitySlider.addTarget(self, action: #selector(sliderChanged), for: .valueChanged)
        intensitySlider.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(intensitySlider)

        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: intensitySlider.topAnchor, constant: -16),
            intensitySlider.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            intensitySlider.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            intensitySlider.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
        ])
    }

    // MARK: - PHContentEditingController

    // 3. Check whether we can resume editing from existing adjustment data.
    //    Return true only if the data was created by this extension and version.
    func canHandle(_ adjustmentData: PHAdjustmentData) -> Bool {
        return adjustmentData.formatIdentifier == Self.formatIdentifier
            && adjustmentData.formatVersion == Self.formatVersion
    }

    // 4. Called before the view appears. Receive the asset and restore prior edits.
    func startContentEditing(with contentEditingInput: PHContentEditingInput, placeholderImage: UIImage) {
        input = contentEditingInput

        // 5. If we have prior adjustment data from a previous session, decode it
        //    to restore the slider position.
        if let adjustmentData = contentEditingInput.adjustmentData,
           adjustmentData.formatIdentifier == Self.formatIdentifier,
           let params = try? JSONDecoder().decode(EditParameters.self, from: adjustmentData.data) {
            filterIntensity = params.intensity
            intensitySlider.value = filterIntensity
        }

        // 6. Show the placeholder immediately, then apply the filter
        imageView.image = placeholderImage
        applyFilter()
    }

    // 7. Render the final output and return it via the completion handler.
    func finishContentEditing(completionHandler: @escaping (PHContentEditingOutput?) -> Void) {
        guard let input = input else {
            completionHandler(nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async { [self] in
            let output = PHContentEditingOutput(contentEditingInput: input)

            // 8. Encode the current parameters as adjustment data so the edit
            //    can be reconstructed in a future session.
            let params = EditParameters(intensity: filterIntensity)
            guard let paramData = try? JSONEncoder().encode(params) else {
                completionHandler(nil)
                return
            }

            output.adjustmentData = PHAdjustmentData(
                formatIdentifier: Self.formatIdentifier,
                formatVersion: Self.formatVersion,
                data: paramData
            )

            // 9. Load the full-size image and apply the filter at full resolution.
            guard let fullSizeURL = input.fullSizeImageURL,
                  let fullImage = CIImage(contentsOf: fullSizeURL)?
                    .oriented(forExifOrientation: Int32(input.fullSizeImageOrientation)) else {
                completionHandler(nil)
                return
            }

            let filtered = self.applyFilterChain(to: fullImage, intensity: self.filterIntensity)

            // 10. Write the rendered JPEG to the output URL.
            //     Use a CIContext to avoid loading the full image into a UIImage.
            guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
                  let jpegData = self.ciContext.jpegRepresentation(
                    of: filtered,
                    colorSpace: colorSpace,
                    options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.9]
                  ) else {
                completionHandler(nil)
                return
            }

            do {
                try jpegData.write(to: output.renderedContentURL)
                completionHandler(output)
            } catch {
                NSLog("[PhotoEditing] Failed to write output: \(error)")
                completionHandler(nil)
            }
        }
    }

    var shouldShowCancelConfirmation: Bool {
        // 11. Return true if the user has made changes worth confirming
        return filterIntensity != 0.5
    }

    func cancelContentEditing() {
        // 12. Clean up any temporary files or state
        input = nil
    }

    // MARK: - Filter Logic

    @objc private func sliderChanged(_ sender: UISlider) {
        filterIntensity = sender.value
        applyFilter()
    }

    private func applyFilter() {
        guard let input = input,
              let url = input.fullSizeImageURL,
              let image = CIImage(contentsOf: url)?
                .oriented(forExifOrientation: Int32(input.fullSizeImageOrientation)) else { return }

        let filtered = applyFilterChain(to: image, intensity: filterIntensity)

        // 13. Render a display-size preview. Use a smaller extent to save memory.
        if let cgImage = ciContext.createCGImage(filtered, from: filtered.extent) {
            DispatchQueue.main.async {
                self.imageView.image = UIImage(cgImage: cgImage)
            }
        }
    }

    // 14. Apply a sepia tone + vignette filter chain. The intensity parameter
    //     controls both the sepia amount and vignette radius.
    private func applyFilterChain(to image: CIImage, intensity: Float) -> CIImage {
        let sepia = CIFilter(name: "CISepiaTone")!
        sepia.setValue(image, forKey: kCIInputImageKey)
        sepia.setValue(NSNumber(value: intensity), forKey: kCIInputIntensityKey)

        let vignette = CIFilter(name: "CIVignette")!
        vignette.setValue(sepia.outputImage!, forKey: kCIInputImageKey)
        vignette.setValue(NSNumber(value: intensity * 2.0), forKey: kCIInputRadiusKey)
        vignette.setValue(NSNumber(value: intensity), forKey: kCIInputIntensityKey)

        return vignette.outputImage!
    }
}

// 15. Codable struct for serializing edit parameters into PHAdjustmentData.
//     Keep this lightweight -- store the recipe, not the rendered pixels.
struct EditParameters: Codable {
    let intensity: Float
}
```

## Usage

- Create: `bun create target photo-editing`
- Edit: `targets/photo-editing/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 8.0+ | Full support. Extension appears in the Photos app Edit screen. |
| iPadOS | 8.0+ | Full support. Must handle Slide Over and Split View presentations. |
| macOS | 10.11+ | Supported. Uses a combined title bar and toolbar instead of a navigation bar. |
| tvOS | -- | Not supported. Photos app on tvOS does not support editing extensions. |
| visionOS | -- | Not supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **`PHAdjustmentData` round-trips are required for a good user experience.** If your `canHandle(_:)` returns `false` for your own previous edits, the user gets the flattened (already-rendered) image instead of the original, losing the ability to tweak prior adjustments. Always check `formatIdentifier` and `formatVersion` and decode your parameters.
- **Returning `true` from `canHandle` means you get the original image.** This is counterintuitive. When you claim you can handle the adjustment data, Photos gives you the unmodified original so you can reconstruct the edit from scratch. When you return `false`, you get the previously rendered output. Many developers expect the opposite.
- **Store the recipe, not the result, in adjustment data.** The `PHAdjustmentData.data` blob has a size limit enforced by the Photos framework. Serialize filter names and parameter values (a few hundred bytes), not pixel data or thumbnails.
- **Full-size images can be very large.** A 48MP iPhone 15 Pro photo is over 8000x6000 pixels. Loading it uncompressed into a `UIImage` can consume hundreds of megabytes. Use `CIImage` with a `CIContext` for lazy evaluation, and render only the regions you need. Extensions are killed under memory pressure with no warning.
- **Image orientation must be applied manually.** The `fullSizeImageOrientation` property on `PHContentEditingInput` returns the EXIF orientation as an `Int32`. You must apply it to your `CIImage` with `.oriented(forExifOrientation:)` or the image will appear rotated. This is a common source of bugs.
- **Video editing has a different workflow.** For video assets, `PHContentEditingInput` provides an `avAsset` (AVAsset) instead of an image URL. You must use AVFoundation (`AVAssetExportSession` or `AVComposition`) to produce the output video. The `PHAdjustmentData` round-trip requirement still applies.
- **The Photos app provides the navigation bar.** Do not add your own navigation bar or top toolbar. Photos displays a system navigation bar with Cancel and Done buttons. Adding your own creates a confusing double-bar UI.
- **Cross-app adjustment data compatibility is possible but rare.** Multiple apps can agree on a shared `formatIdentifier` and data schema so users can seamlessly switch between editing tools. In practice, almost no apps do this -- but be aware that your extension may receive adjustment data from an unknown source.
- **The Xcode template defaults `canHandle` to `false`.** The generated stub returns `false`, which means re-editing always starts from the flattened output. You must change this to support proper non-destructive editing.
- **Test with varied media formats.** Do not assume all inputs are JPEG from the device camera. HEIF, PNG, RAW (DNG), and Live Photos all flow through the same extension. Verify your `CIFilter` chain handles each format without crashing.
