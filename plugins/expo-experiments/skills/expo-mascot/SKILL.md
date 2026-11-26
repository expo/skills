---
name: expo-mascot
description: Create a customizable 2D mascot for an Expo app. Use for a numbered mascot concept sheet, a transparent base image, a Rive rig or idle loop, fitted outfit images, swappable Rive outfit slots, or placing an animated mascot on an Expo screen.
license: MIT
---

# Expo Mascot

Pick the action that matches the request and open its reference. Start with any action the user has inputs for. In a full workflow, wait for the user to select a sheet concept before creating the base or rigging it.

Default generated artwork to a square canvas, including each cell of the concept sheet. Use a front-facing, standing idle pose unless requested otherwise. Use the approved base as the reference for the silhouette, proportions, placement, and outfit registration. Keep the base and outfit art aligned on the same full canvas.

Return generated mascot artwork as lossless WebP. Preserve transparency where the artwork needs it. If the image tool returns another format, encode the finished artwork as WebP before handing it off.

Before a Rive action, check the [CLI setup](./references/set-up-rive-project.md#check-the-cli). Start local authoring, verification, and capture without signing in. Check sign-in when exporting `.riv` or `.rev` files or accessing the user's project in the Rive Editor.

When the user asks for the mascot on a specific Expo screen, follow [Add the mascot to an Expo screen](./references/add-to-expo-screen.md) with the supplied or newly exported runtime asset.

## Create a mascot image sheet

`create-mascot-sheet` uses a character description, image, or video to generate one numbered 3 × 3 sheet of nine 2D concepts. If the user supplies none of those inputs, ask for one. Follow [Create a mascot image sheet](./references/mascot-image-sheet.md).

> Use this beagle photo to make nine front-facing mascot concepts in a numbered 3 × 3 sheet.

## Create a base image

`create-base-image` turns a selected concept into one high-resolution lossless WebP with alpha. Use a square canvas by default. Follow [Create a base image](./references/create-base-image.md).

> Turn concept 4 into a high-resolution transparent WebP and preserve its proportions.

## Create a Rive asset

`create-rive-asset` builds a deformable rig from the approved base and returns the project, runtime asset, and Rive Editor link. Follow [Set up the Rive project](./references/set-up-rive-project.md).

> Build a Rive rig from this base image and send me the Editor link.

## Add idle motion

`add-mascot-idle-motion` adds a looping animation named `idle` to the existing rig and returns a video. Follow [Add mascot idle motion](./references/add-mascot-idle-motion.md).

> Add a gentle breathing loop to this Rive mascot and show me a video.

## Create an outfit image

`create-outfit-image` uses a description or reference image to make a fitted garment on the approved mascot's canvas. Return the fitted outfit as a lossless WebP with alpha and include a try-on preview. Follow [Create an outfit image](./references/create-outfit-image.md).

> Use this raincoat photo to make a transparent outfit WebP that fits my mascot.

## Bind a Rive outfit

`bind-rive-outfit` uses an outfit image or description to determine the slot and attachment. Prepare the garment if needed, bind it to a Rive View Model `Image` property, and check its fit during idle. Follow [Bind a Rive outfit](./references/bind-rive-outfit.md).

> Use this bucket hat photo to add a swappable hat that follows the mascot's head during idle.

## Submitting Feedback
If this skill has an error, or misleading or outdated information, tell the user and offer to report it to Expo. A report is optional, and the user decides. Do not send a report before the user agrees.
The `feedback` command of the agent CLI sends a report. Its `--help` lists the categories (`skills` with the subject "expo-mascot", `agent-cli` for a problem with the agent CLI, `evals` when an agent repeatedly fails at an Expo task) and the data that a report sends. Show the user the message, and tell the user that the report also carries project and environment details. If you cannot ask the user, put the command with your message in your final summary, so the user can send it. Do not include secrets or personal data.
