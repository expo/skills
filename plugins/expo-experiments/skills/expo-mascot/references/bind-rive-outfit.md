# Bind a Rive outfit

Run the [Rive CLI setup check](./set-up-rive-project.md#check-the-cli) before editing the project.

## Resolve the garment

Accept a fitted image with alpha, including a PNG supplied by the user. Encode the app-ready garment as lossless WebP while preserving its full canvas and placement. If the request supplies a photo or description, use [Create an outfit image](./create-outfit-image.md) to identify the slot, prepare the garment WebP on the approved base canvas, and check the overlay. Honor a slot or placement the user specified. Ask where to attach the garment only when the intended placement cannot be inferred.

Inspect the current artboard, state machine, view model, and rig. Reuse their names, IDs, and existing slot bindings. A hat follows the head, while sleeves follow the torso and arm deformation. Match the base image's scale, origin, and transform in the artboard. For garments spanning moving regions, use the relevant bones or matching mesh weights. A pair of shoes must follow the two feet as each moves. Check draw order against the base, other slots, and any occluding limbs. Among sibling drawables in RML, write a front outfit image before the body image it should cover. Check the rendered garment at rest and in motion. A valid image binding can be hidden behind the body.

## Author the image binding

Bind a drawable image in the target slot to a View Model `Image` property. Give the node and its default instance a fully transparent lossless WebP at the full base canvas size if the slot starts empty. Keep the same canvas registration for every replacement. If the slot needs multiple drawables, bind each to the same image property and crop or mesh each to the region it follows.

Use `rive docs data` and `rive schema Image --bindable` for the installed RML syntax. In the CLI, `ViewModelPropertyAssetImage` declares the property, `ViewModelInstanceAssetImage` sets its default asset, and a `DataBindContext` nested under the `Image` connects it to `Image.assetId`.

This example defines an empty `hat` slot. Set the artboard's `viewModelId` to `0:50` and its `viewModelInstanceId` to `0:52` for Editor preview. Make sure `defaultStateMachineId` points to the mascot's state machine so the CLI preview applies the bind. Place the image inside the head attachment at the coordinates derived from the approved base.

```xml
<Image name="Hat" assetId="0:60" id="0:20">
    <DataBindContext sourcePathIds="0:50-0:51" propertyKey="206"/>
</Image>

<ImageAsset file="assets/transparent.webp" name="Transparent Outfit" id="0:60"/>

<ViewModel defaultInstanceId="0:52" name="MascotOutfit" id="0:50">
    <ViewModelPropertyAssetImage name="hat" id="0:51"/>
    <ViewModelInstance exports="true" name="Default" id="0:52">
        <ViewModelInstanceAssetImage propertyValue="0:60" viewModelPropertyId="0:51"/>
    </ViewModelInstance>
</ViewModel>
```

Add to the existing view model when one is already bound. For a nested slot, place the image property in the linked model and include each intermediate `ViewModelPropertyViewModel` ID in `sourcePathIds`. Verify the property key and use project-local IDs. See [Rive View Model Image properties](https://rive.app/docs/editor/data-binding/property-types#image).

## Validate and return the result

Run `rive <project-dir> --verify` and `rive inspect <project-dir>` to check the scene and binding. Preview the garment through a full `idle` loop. If needed, use a temporary copy of the project with the garment as the test instance's default image. Keep any returned preview outside the temporary directory and remove the copy after the check. If you changed the default in the authored project, restore the intended default before exporting and verify again. Use [Add mascot idle motion](./add-mascot-idle-motion.md) for capture guidance.

Export the [updated runtime file](./set-up-rive-project.md#export-and-return-the-editor-link) and load it in an [Expo development build](./add-to-expo-screen.md). Keep one bound View Model instance on `RiveView`. Resolve its root View Model definition with `riveFile.defaultArtboardViewModelAsync(ArtboardByName(artboardName))` for the artboard's default binding or `riveFile.viewModelByNameAsync(viewModelName)` for a model you explicitly bound.

Validate the slot against that definition before looking up the image property. For `outfit/hat`, check that `outfit` is a `viewModel` property on the root, then check that `hat` is an `assetImage` on the model linked by `outfit`. Follow the same rule for paths such as `outfit/top` and `outfit/accessories/glasses`. Use exact property names at every step.

Build `nestedModels` from the same project as the export, keyed by the full path to each nested property. In RML, follow the property's `viewModelReferenceId` to the referenced `ViewModel` and use that definition's name as the value. For example, `outfit` might map to `Wardrobe` and `outfit/accessories` to `Accessories`. Use an empty map for an export with only top-level slots. In Rive 0.5.17, `getPropertiesAsync()` on a model definition lists property names and types, and the nested instance returned by `viewModelAsync()` lacks the metadata needed to list its own properties. Use the linked definition to read the nested schema. [React Native View Model data binding](https://rive.app/docs/runtimes/react-native/data-binding#nested-view-models)

```ts
import type { RiveFile, ViewModel } from '@rive-app/react-native';

async function hasImageSlot(
  riveFile: RiveFile,
  rootModel: ViewModel,
  slot: string,
  nestedModels: ReadonlyMap<string, string>,
): Promise<boolean> {
  const parents = slot.split('/');
  const leaf = parents.pop();
  if (!leaf || parents.includes('')) return false;

  let model = rootModel;
  let parentPath = '';
  for (const parent of parents) {
    const properties = await model.getPropertiesAsync();
    if (!properties.some(({ name, type }) => name === parent && type === 'viewModel')) {
      return false;
    }
    parentPath = parentPath ? `${parentPath}/${parent}` : parent;
    const modelName = nestedModels.get(parentPath);
    if (!modelName) return false;
    const child = await riveFile.viewModelByNameAsync(modelName);
    if (!child) return false;
    model = child;
  }

  const properties = await model.getPropertiesAsync();
  return properties.some(({ name, type }) => name === leaf && type === 'assetImage');
}
```

Reject a slot when `hasImageSlot` returns false, including on clear. If the nested instance can be unset, also verify that `await instance.viewModelAsync(parentPath)` returns an instance for the path before the final slash. On iOS, `instance.imageProperty(slot)` can return a proxy for an unknown path and `setValueAsync(image)` can resolve without changing the image.

Use `RiveImages.loadFromBytesAsync` or `RiveImages.loadFromURLAsync` to load a fitted WebP that was absent from the exported file. Pass the full validated path to `instance.imageProperty(slot)` on the root instance and call `set(image)` on the property. Reapply the transparent WebP to clear the slot. To wait for the native binding before displaying the first outfit, await `setValueAsync(image)` with `@rive-app/react-native` 0.5.16 or later. Check a valid top-level slot and, when present, a valid nested slot. Confirm that misspelled paths, non-model parents, and non-image leaves are rejected before the setter. Verify equip, swap, and clear while the same idle loop continues, and inspect alignment and overlap at the motion extremes. See [React Native Image data binding](https://rive.app/docs/runtimes/react-native/data-binding#images).

For a catalog, make a contact sheet of worn items with the neutral frame and both extremes of the idle motion. Include tops with the paws visible and shoes with both soles in frame. Inspect the actual runtime rendering at display size for sliding cuffs, exposed paws inside closed shoes, and rear edges drawn over the body. Correct the art, attachment, or draw order at its source and render the affected combinations again before recording the result.

Return the updated project and `.riv`, the exact artboard, state-machine, and image property names, and a preview of the result. Label what you checked in the CLI and what you ran in the Expo development build. If you had no development build available, report runtime swapping as unverified.
