# Create an outfit image

Use the approved base image and an outfit description, reference image, or existing garment asset. If the mascot already has a Rive rig, read its attachment points and artwork-to-artboard transform before positioning the garment.

## Identify the slot and placement

Use a slot named in the request. Otherwise, infer the slot from the garment and its intended position. Ask one focused question when the choice changes the attachment or draw order. For example, ask whether a bow belongs on the head or at the neck if the reference leaves that unclear.

| Default slot | Fit against the base |
| --- | --- |
| `hat` | Align to the top of the head. Check brim clearance and intentional overlap with the ears. |
| `top` | Align the neckline and shoulders. Follow the torso and sleeve outlines. |
| `bottom` | Align the waist and leg openings. Check where the top overlaps the waist. |
| `shoes` | Fit each shoe around its foot and keep both soles on the ground line. |
| `necklace` | Align to the neck or upper chest. Check clearance below the chin and over clothing. |
| `glasses` | Align the bridge and lenses to the eyes and nose. Check temples against the ears. |

## Create and check the image

1. Give the image generation or editing tool the approved base as the placement guide. Use any garment reference for shape, materials, and details. Match the base illustration's line weight, lighting, and perspective.
2. Request only the wearable pixels on a transparent background, at the same scale and position as they would appear over the base. A photo of a person wearing the item can guide the design. Leave the person, mascot, labels, and background out of the garment image.
3. Export a lossless WebP with alpha on the full base canvas. Request WebP from the image tool when supported. If the tool produces another format, encode the fitted image as lossless WebP after alignment. For example, use `cwebp -lossless fitted.png -o outfit.webp`. Preserve its dimensions, aspect ratio, and origin. Keep the transparent margins so the garment can swap into the same image node without shifting. Align or pad an existing asset if it already matches the art style.
4. Decode the WebP and composite it over the base for a try-on preview. Check that the overlay fits at the planned draw depth, the outline is clean, the garment is inside the canvas, and empty pixels are transparent. Adjust placement or the garment before returning it.

For a top, compare the dressed and bare silhouettes at the chin, shoulders, cuffs, and waist. The back of a hood or collar disappears behind the neck. Sleeves wrap around the arms and end at the wrists or upper arms appropriate to the design. Check for exposed strips of the original torso, doubled outlines, and a flat hem floating across the belly. For shoes, inspect each heel, toe, and ankle separately. Preserve the shoe’s proportions and let the opening surround the ankle. Redraw the affected edge or use a front/back layer when a single flat overlay cannot produce that overlap.

Return the fitted `.webp` and a WebP try-on preview. If requested, include a smaller WebP thumbnail separately. State the slot and what it should follow in the rig. To make the image swappable, continue with [Bind a Rive outfit](./bind-rive-outfit.md).
