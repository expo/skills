# Set up a Rive project

Use this workflow for `create-rive-asset`. The CLI checks also apply before `add-mascot-idle-motion` and `bind-rive-outfit`.

## Check the CLI and sign-in

Run `rive --version` and `rive whoami` in the environment that will author and export the project. Use the actual failure to decide what to ask for. Pause the Rive action and give the user a next step.

| What failed | What to tell the user |
| --- | --- |
| The `rive` command is missing | "Install the Rive CLI using the [official setup guide](https://rive.app/agents), make sure `rive --version` works in your terminal, then tell me when it's ready." |
| The session is missing or expired | "Run `rive login`, approve the sign-in in your browser, then tell me when you're signed in." |
| The CLI reports that its version is unsupported | "Update Rive CLI using the same method you installed it with, then tell me when `rive --version` works." |
| The account service is unreachable | "The Rive CLI couldn't reach the account service. Check your connection, then tell me when `rive whoami` succeeds." |
| The signed-in account lacks access to the target file or project | "Send me the Editor link for a file you can edit, or choose a project where this account can create a Rive file." |

Recheck setup before resuming. Treat signing or sync failures the same way if they occur later. The user completes browser sign-in.

## Build the rig from the approved base

1. Open the existing CLI project or create a new one in an empty directory with `rive create <project>`. To start from a local editable file, use `rive create <project> --from-rev=<file.rev>`. To start from an Editor file, use `rive create <project> --from-remote-file=<fileId>`. Preserve the existing project's names and IDs.
2. Read the generated project instructions. Use `rive docs rigging`, `rive docs state-machines`, and `rive schema <Type>` to check the local RML syntax.
3. Add the approved transparent base as source art. Record how its full canvas maps to the artboard so outfit images use the same origin and scale. Leave room for motion and wearables.
4. Rig the head, torso, and visible limbs with movable pivots and named attachment points. Skin the source image with a triangulated mesh and weighted bones where the art needs to bend. For a rigid part such as an accessory, use a separate layer attached to its joint. Preserve the approved pixels, especially at the face and overlapping joints. Keep the paw baseline stable.
5. Select or create the artboard and state machine. Wire the artboard to the machine and use `rive inspect` to read their exact names. Use those names, including case and spaces, in the handoff and any Expo code that loads the asset.
6. Verify the scene and capture the neutral pose. Compare it with the approved PNG at the same scale. Test a small motion on the rig to confirm the joints deform or follow as intended. Inspect the face, seams, silhouette, and paw baseline before proceeding.

```bash
rive "$project" --verify
rive inspect "$project" --json
rive "$project" --artboard="$artboard" --screenshot="$neutral_png"
```

## Export and return the Editor link

Use local export for the runtime and editable files. Pick output paths that preserve any previous exports the user still needs.

```bash
rive "$project" --publish --rev="$editable_rev"
```

For the Editor link, sync to the user's requested workspace and project. On the first push, use `rive ls` to find the intended project ID, then use `rive push "$project" --project="$project_id"`. Add `--folder="$folder_id"` when the user wants a specific folder. For an existing link, check the file ID in `rive.yaml` and confirm the target and latest Editor changes before updating it. Return the real URL from `rive open "$file_id" --print`. The Editor link respects that workspace's access settings. Publish a public web page only when the user asks for one.

If the CLI reports an exhausted [monthly allowance](https://rive.app/docs/cli/monthly-allowance), tell the user which workspace hit its limit and when it resets. Check `push.fileId` before retrying. A failed first push can create and link an empty Editor file. Return the editable `.rev` and report the status of any file the CLI already created. If the workspace plan allows [Editor imports](https://rive.app/docs/editor/exporting/exporting-for-backup#importing-a-backup), the user can import the `.rev` as a new file.

Return the Editor URL, editable project and `.rev` paths, runtime `.riv` path, exact artboard and state-machine names, and neutral render. If export or sync fails, report what was produced and give the next step for the operation that failed.
