# Instrumentation decisions

Use [Observe setup](https://docs.expo.dev/eas/observe/get-started/) for the supported
SDK's code. This reference keeps integration decisions rather than a second copy
of the setup tutorial. For dependencies and EAS linking, use the relevant
[project setup rules](../../expo-overview/references/project-setup.md).

## Version and scope

- SDK 55 uses `AppMetricsRoot` and `AppMetrics.markInteractive`; SDK 56+ uses
  `ObserveRoot` and `useObserve`. Verify exports in the installed package and use
  its matching path. Do not run `expo install --fix` or upgrade the SDK just to
  install one package without a diagnosed compatibility problem.
- Use `npx expo install expo-observe` when installation is requested. Observe
  needs a development/production build; a successful Expo Go screen does not
  establish that the integration works.
- Preserve the existing root providers, splash flow, and auth/loading behavior.
  Choose the ready point where the entry screen is usable; an early call records
  an artificially fast TTI. Cover relevant deep links, onboarding, and signed-out
  entry screens, not only the home route.

## Add only the requested integrations

Read [Expo Router integration](https://docs.expo.dev/eas/observe/integrations/expo-router/)
or [React Navigation integration](https://docs.expo.dev/eas/observe/integrations/react-navigation/)
when per-route metrics are needed. Configure before screens mount. Keep options
in one configuration call when calls replace the previous configuration, and put
screen-scoped readiness calls inside the corresponding mounted/focused screen.
For React Navigation, connect the provider to the same navigation ref/container.

Check [configuration](https://docs.expo.dev/eas/observe/configuration/) for dispatch,
sampling, and filtering. Inspect actual route/query params and event payloads so
sensitive values are not exported accidentally. Do not add unrelated product
analytics to a performance-instrumentation task.

For custom events, use the [events docs](https://docs.expo.dev/eas/observe/events/)
and stable names. Read the current setup/error-reporting guidance and installed
exports before changing exception handling: catching a render error also changes
what the user sees, and handling an exception is distinct from native crash coverage.

## Verify collection and delivery separately

Exercise the affected entry or navigation path in a compatible build. Confirm the
readiness call runs at the intended point, and inspect emitted data in the intended
project/environment. Debug collection does not imply dispatch: use the documented
debug-dispatch setting only when needed, keeping test data distinguishable from
production. An environment label alone is not a dispatch gate.

If a build, credential, plan feature, or backend is unavailable, complete independent
instrumentation and report delivery verification as incomplete. A requested build
or query can proceed within existing authorization; avoid inserting a fresh approval
pause just because a documentation walkthrough asks its reader one.
