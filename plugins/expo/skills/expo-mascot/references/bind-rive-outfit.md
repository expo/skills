# Bind a Rive outfit

Follow the CLI and sign-in checks in [Set up a Rive project](./set-up-rive-project.md) before editing the project.

## Resolve the garment

Use a fitted transparent PNG if the user provided one. If the request supplies a photo or description, use [Create an outfit image](./create-outfit-image.md) to identify the slot, prepare the garment PNG on the approved base canvas, and check the overlay. Honor a slot or placement the user specified. Ask where to attach the garment only when the intended placement cannot be inferred.

Inspect the current artboard, state machine, view model, and rig. Reuse their names, IDs, and existing slot bindings. A hat follows the head, while sleeves follow the torso and arm deformation. Match the base image's scale, origin, and transform in the artboard. For garments spanning moving regions, use the relevant bones or matching mesh weights. A pair of shoes must follow the two feet as each moves. Check draw order against the base, other slots, and any occluding limbs.

## Author the image binding

Bind a drawable image in the target slot to a View Model `Image` property. Give the node and its default instance a transparent asset at the full base canvas size if the slot starts empty. Keep the same canvas registration for every replacement. If the slot needs multiple drawables, bind each to the same image property and crop or mesh each to the region it follows.

Use `rive docs data` and `rive schema Image --bindable` for the installed RML syntax. In the CLI, `ViewModelPropertyAssetImage` declares the property, `ViewModelInstanceAssetImage` sets its default asset, and a `DataBindContext` nested under the `Image` connects it to `Image.assetId`.

This example defines an empty `hat` slot. Set the artboard's `viewModelId` to `0:50` and its `viewModelInstanceId` to `0:52` for Editor preview. Make sure `defaultStateMachineId` points to the mascot's state machine so the CLI preview applies the bind. Place the image inside the head attachment at the coordinates derived from the approved base.

```xml
<Image name="Hat" assetId="0:60" id="0:20">
    <DataBindContext sourcePathIds="0:50-0:51" propertyKey="206"/>
</Image>

<ImageAsset file="assets/transparent.png" name="Transparent Outfit" id="0:60"/>

<ViewModel defaultInstanceId="0:52" name="MascotOutfit" id="0:50">
    <ViewModelPropertyAssetImage name="hat" id="0:51"/>
    <ViewModelInstance exports="true" name="Default" id="0:52">
        <ViewModelInstanceAssetImage propertyValue="0:60" viewModelPropertyId="0:51"/>
    </ViewModelInstance>
</ViewModel>
```

Add to the existing view model when one is already bound. Verify the property key and use project-local IDs. See [Rive View Model Image properties](https://rive.app/docs/editor/data-binding/property-types#image).

## Validate and return the result

Run `rive <project-dir> --verify` and `rive inspect <project-dir>` to check the scene and binding. Preview the garment through a full `idle` loop. If needed, use a temporary copy of the project with the garment as the test instance's default image. Rive's CLI preview can show authored assets, while Expo verifies a new image supplied at runtime. Restore the intended default before exporting and verify again. Use [Add mascot idle motion](./add-mascot-idle-motion.md) for capture guidance.

Export the updated runtime file using the local export instructions in [Set up a Rive project](./set-up-rive-project.md). In an Expo development build using the exported asset, load a fitted PNG that was absent from the exported file. Keep one bound View Model instance on `RiveView`. Load the new image with `RiveImages.loadFromBytesAsync` or `RiveImages.loadFromURLAsync` and set it with `instance.imageProperty(slot)?.set(image)`. Reapply the transparent image to clear an empty slot. Verify equip, swap, and clear while the same idle loop continues, and inspect alignment and overlap at the motion extremes. See [Adding Rive to Expo](https://rive.app/docs/runtimes/react-native/adding-rive-to-expo) and [React Native Image data binding](https://rive.app/docs/runtimes/react-native/data-binding#images).

Return the updated project and `.riv`, the exact artboard, state-machine, and image property names, and a preview of the result. Label what you checked in the CLI and what you ran in the Expo development build. If you had no development build available, report runtime swapping as unverified.
