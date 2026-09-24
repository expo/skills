# Route organization and history

Use [Router notation](https://docs.expo.dev/router/basics/notation/) for file syntax,
[layouts](https://docs.expo.dev/router/basics/layout/) for navigator/provider scope,
and [shared routes](https://docs.expo.dev/router/advanced/shared-routes/) when one
screen must participate in multiple navigation groups. Read the relevant installed
SDK's Router API for settings that changed between versions.

## Preserve the route contract

Keep routes in the project's actual `app/` or `src/app/` tree. Brackets define
parameters; parentheses define groups that do not add URL segments. Ordinary
components/utilities belong outside the route tree. Screens need a default component
export, but special files such as `+api.ts` have their own contracts; do not impose
a screen export on every file.

A group can give screens a different layout without changing their public path.
That also means moving files into groups can create ambiguous/colliding URLs.
Trace the requested path, its owning layouts, and links before restructuring.
Keep `/` reachable and preserve an intentional not-found/recovery route.

## Choose navigation ownership

Put a stack inside each tab when each tab needs its own header and back history.
A shared screen may be declared in multiple groups when it should push within the
current tab; do not replace the whole app layout with an array-group example merely
to share UI. Reusing a screen component outside the route tree can be sufficient.

For shared/array routes, verify the installed version's anchor/initial-route settings
and direct-entry behavior. A deep link lacks the same history as an in-app push;
check the desired back destination on both paths. Do not mechanically rename a
setting based on an old example.

Use local search params for route-local state where appropriate. URL parameters
are external input; validate expected shapes rather than treating TypeScript
annotations as runtime validation. Preserve repeated/catch-all parameter semantics.

For platform variants, follow [platform modules](https://docs.expo.dev/router/advanced/platform-specific-modules/):
route variants require a default route file. Keep one URL and compatible screen
behavior across the supported targets.

Verify cold/direct entry, internal links, back/dismiss, tab switching, and invalid
parameters for the changed routes. Removing an old file is complete only when
its intended entry points still work or have an intentional migration path.
