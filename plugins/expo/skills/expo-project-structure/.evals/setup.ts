/**
 * Proposed setup descriptor for a plugin-owned skill eval.
 *
 * The current @expo/skill-eval-kit ProjectSetup requires an npm package under
 * test. expo-project-structure belongs to the Expo plugin instead, so this
 * shape deliberately contains only the skill and scaffold facts that a future
 * shared runner needs.
 */
export function setupProject() {
  return {
    skillDir: new URL('..', import.meta.url),
    baseTemplate: 'blank-typescript',
  } as const;
}
