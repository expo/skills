import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const skill = readFileSync(
  join(import.meta.dir, "../plugins/expo/skills/expo-tailwind-setup/SKILL.md"),
  "utf8",
);

describe("expo-tailwind-setup guidance", () => {
  test("uses the current Nativewind v5 dependency channel", () => {
    expect(skill).toContain("nativewind@preview react-native-css@latest");
    expect(skill).toContain("react-native-reanimated react-native-safe-area-context");
    expect(skill).not.toContain("nativewind@5.0.0-preview.2");
    expect(skill).not.toContain("react-native-css@0.0.0-nightly.5ce6396");
  });

  test("uses the current default configuration and direct className API", () => {
    expect(skill).toContain("module.exports = withNativewind(config);");
    expect(skill).toContain('@import "nativewind/theme";');
    expect(skill).toContain('from "react-native";');
    expect(skill).not.toContain('from "@/tw"');
  });

  test("documents package-manager-specific Lightning CSS overrides", () => {
    expect(skill).toMatch(/For npm,[\s\S]*"overrides"[\s\S]*"lightningcss": "1\.30\.1"/);
    expect(skill).toMatch(/For Yarn,[\s\S]*"resolutions"[\s\S]*"lightningcss": "1\.30\.1"/);
    expect(skill).toMatch(/For pnpm 11,[\s\S]*pnpm-workspace\.yaml[\s\S]*overrides:\n  lightningcss: 1\.30\.1/);
  });
});
