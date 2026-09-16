---
name: eas-hosting
description: "EAS service (paid). Author Expo Router API routes or deploy Expo web apps to EAS Hosting, including domains and environments. For native builds and store submission, use eas-app-stores."
version: 1.0.1
license: MIT
---

# EAS Hosting and API routes

> **EAS service - costs apply.** Hosting deployments and traffic use the project's EAS plan. See [current limits](https://expo.dev/pricing). Authoring API routes and exporting locally are framework features; self-hosting is also possible.

Match the requested work: author a route, deploy an existing web app, or diagnose
a hosting failure. Local route work does not require an EAS deployment. Preserve
the project's existing backend and hosting choice unless moving it is requested.

## Read the relevant source

- **Route implementation:** [API routes](https://docs.expo.dev/router/web/api-routes/) for `+api.ts`, handler signatures, server output, native requests, and self-hosting adapters.
- **First deployment:** [Hosting setup](https://docs.expo.dev/eas/hosting/get-started/) for output modes and project linking.
- **Preview or production destination:** [deployments and aliases](https://docs.expo.dev/eas/hosting/deployments-and-aliases/).
- **Server dependencies or runtime failures:** [worker runtime](https://docs.expo.dev/eas/hosting/reference/worker-runtime/) for the actual supported Node APIs. Do not assume either full Node compatibility or that every Node API is unavailable.
- **Domains:** [custom domains](https://docs.expo.dev/eas/hosting/custom-domain/).
- **Automation:** use `eas-workflows` for current job schemas and validation, rather than copying a stored workflow template.

Use the relevant [project setup rules](../expo-overview/references/project-setup.md)
when configuration or dependencies change. Read only the source needed; existing
version-matched evidence can be reused. If docs are unavailable, inspect installed
CLI help/types and describe any API or runtime assumptions that remain unverified.

## Implementing a route

Keep handlers in the existing `app/` or `src/app/` route tree with a `+api.ts`
suffix; keep shared server helpers outside that tree. Server routes require
`web.output: "server"` for export. A route is deployed server code, not code that
runs inside an installed native binary.

Keep server secrets out of `EXPO_PUBLIC_` variables and client imports. Authenticate
with the project's real session/token verifier and enforce access to the requested
resource; the presence of an Authorization header does not establish identity.
Validate request data before writes. Browser CORS policy is separate from auth.

For native clients, use a reachable deployed origin or the Router origin mechanism
supported by the installed SDK. Ordinary native fetch cannot resolve a relative
URL on its own. Confirm the actual fetch import and origin configuration before
changing a working request to an absolute URL.

Use `npx expo start` for development; use `npx expo serve` to inspect an exported
bundle. Exercise the changed method and a relevant invalid/unauthorized request.
Do not treat a successful export as evidence that authentication or runtime
compatibility works in Hosting.

## Deploying

Establish the EAS project, environment, and preview or production destination from
the request and existing configuration. Preserve existing authorization; clarify
an ambiguous destination before publishing. Resolve server environment values
for the chosen deployment, without printing secrets.

Export current source with `npx expo export --platform web`. With a compatible
EAS CLI, `eas deploy` creates a preview and `eas deploy --prod` publishes to
production. Check `eas deploy --help` for environment and alias options needed by
the task. Do not deploy a stale `dist/` or infer production from the Git branch.

After an authorized deployment, verify the returned URL and an affected route,
then report the deployment/destination and checks performed. If auth, billing,
or runtime access blocks completion, finish independent local work and identify
the remaining deployment or verification step.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-hosting" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
