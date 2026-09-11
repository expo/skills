// Check the published CLI packages behind the version guidance in
// eas-app-stores/references/testflight.md without contacting an Expo project.
// Requires network access to npm and tar: bun test scripts/testflight-cli-versions.test.ts

import { expect, test } from "bun:test";
import { semver } from "bun";
import { readFileSync } from "node:fs";

const reference = readFileSync(
  new URL(
    "../plugins/expo/skills/eas-app-stores/references/testflight.md",
    import.meta.url,
  ),
  "utf8",
);
const submitVersion = reference.match(/EAS CLI \[(\d+\.\d+\.\d+)\]/)?.[1];
const statusVersion = reference.match(
  /`eas status --json`[^\n]*EAS CLI (\d+\.\d+\.\d+)/,
)?.[1];
if (!submitVersion || !statusVersion) {
  throw new Error(
    "The TestFlight reference must specify both CLI version requirements.",
  );
}

type Command = {
  aliases?: string[];
  flags: Record<string, unknown>;
};

test.each(["21.4.0", "21.5.0", "23.2.0", "24.0.0", "24.2.0"])(
  "EAS CLI %s registers the documented status commands",
  async (version) => {
    const response = await fetch(
      `https://registry.npmjs.org/eas-cli/-/eas-cli-${version}.tgz`,
      { signal: AbortSignal.timeout(30_000) },
    );
    expect(response.ok).toBe(true);

    const archive = Bun.spawnSync(
      ["tar", "-xzOf", "-", "package/oclif.manifest.json"],
      {
        stdin: new Uint8Array(await response.arrayBuffer()),
      },
    );
    expect(archive.exitCode).toBe(0);
    const manifest = JSON.parse(archive.stdout.toString()) as {
      version: string;
      commands: Record<string, Command>;
    };
    expect(manifest.version).toBe(version);

    for (const [name, flags] of [
      ["submit:list", ["platform", "json"]],
      ["submit:view", ["json"]],
      ["submit:status", ["platform", "profile", "json", "non-interactive"]],
    ] as const) {
      const command = manifest.commands[name];
      expect(Boolean(command)).toBe(
        semver.satisfies(version, `>=${submitVersion}`),
      );
      if (command) {
        for (const flag of flags) {
          expect(command.flags).toHaveProperty(flag);
        }
      }
    }

    const status =
      manifest.commands.status ??
      Object.values(manifest.commands).find((command) =>
        command.aliases?.includes("status"),
      );
    expect(Boolean(status)).toBe(
      semver.satisfies(version, `>=${statusVersion}`),
    );
    if (status) {
      expect(status.flags).toHaveProperty("json");
    }
  },
  45_000,
);
