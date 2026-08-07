#!/usr/bin/env bun

// Validates every root `plugin.json` / `mcp.json` against Agent Plugins 1.0.0.
// The published schemas are closed (`additionalProperties: false`), so an extra field is an
// error rather than something clients silently drop. Rules are inlined instead of pulled from
// agent-plugins.org because CI must not depend on the network.
// Spec: https://agent-plugins.org/specification

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

const PLUGIN_FIELDS = new Set([
  "$schema",
  "name",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "extensions",
]);
const AUTHOR_FIELDS = new Set(["name", "email", "url"]);
const NAME_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

const SERVER_VARIANTS: Record<string, { required: string[]; optional: string[] }> = {
  stdio: { required: ["type", "command"], optional: ["args", "env", "cwd"] },
  "streamable-http": { required: ["type", "url"], optional: ["headers"] },
  sse: { required: ["type", "url"], optional: ["headers"] },
};

const errors: string[] = [];

function fail(path: string, message: string) {
  errors.push(`${path}: ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    fail(path, `is not valid JSON (${(error as Error).message})`);
    return null;
  }
}

function checkString(path: string, container: Record<string, unknown>, field: string) {
  if (field in container && typeof container[field] !== "string") {
    fail(path, `\`${field}\` must be a string`);
  }
}

function validateManifest(path: string) {
  const manifest = readJson(path);
  if (manifest === null) {
    return;
  }
  if (!isPlainObject(manifest)) {
    fail(path, "must contain a JSON object");
    return;
  }

  for (const field of Object.keys(manifest)) {
    if (!PLUGIN_FIELDS.has(field)) {
      fail(path, `unknown top-level field \`${field}\` (the manifest schema is closed)`);
    }
  }

  if (manifest.$schema !== PLUGIN_SCHEMA) {
    fail(path, `\`$schema\` must be "${PLUGIN_SCHEMA}"`);
  }

  if (typeof manifest.name !== "string" || !NAME_PATTERN.test(manifest.name) || manifest.name.length > 64) {
    fail(path, "`name` must be 1-64 lowercase alphanumeric characters, hyphens, or periods");
  }

  for (const field of ["version", "description", "homepage", "repository", "license"]) {
    checkString(path, manifest, field);
  }

  if ("keywords" in manifest) {
    const keywords = manifest.keywords;
    if (!Array.isArray(keywords) || keywords.some((keyword) => typeof keyword !== "string")) {
      fail(path, "`keywords` must be an array of strings");
    }
  }

  if ("author" in manifest) {
    if (!isPlainObject(manifest.author)) {
      fail(path, "`author` must be an object");
    } else {
      for (const field of Object.keys(manifest.author)) {
        if (!AUTHOR_FIELDS.has(field)) {
          fail(path, `unknown \`author.${field}\` field`);
        }
      }
      for (const field of AUTHOR_FIELDS) {
        checkString(path, manifest.author, field);
      }
    }
  }

  if ("extensions" in manifest) {
    if (!isPlainObject(manifest.extensions)) {
      fail(path, "`extensions` must be an object");
    } else {
      for (const [namespace, value] of Object.entries(manifest.extensions)) {
        if (!isPlainObject(value)) {
          fail(path, `\`extensions["${namespace}"]\` must be an object`);
        }
        if (!namespace.includes(".")) {
          fail(path, `\`extensions["${namespace}"]\` must use a reverse-domain namespace`);
        }
      }
    }
  }
}

function validateMcpConfig(path: string, manifestPath: string) {
  const config = readJson(path);
  if (config === null) {
    return;
  }
  if (!isPlainObject(config)) {
    fail(path, "must contain a JSON object");
    return;
  }

  for (const field of Object.keys(config)) {
    if (field !== "$schema" && field !== "mcpServers") {
      fail(path, `unknown top-level field \`${field}\``);
    }
  }

  if (config.$schema !== MCP_SCHEMA) {
    fail(path, `\`$schema\` must be "${MCP_SCHEMA}"`);
  }

  // A version mismatch between the two files disables MCP for the whole plugin.
  const manifest = readJson(manifestPath);
  if (isPlainObject(manifest) && typeof manifest.$schema === "string") {
    const manifestVersion = manifest.$schema.split("/").at(-2);
    const mcpVersion = typeof config.$schema === "string" ? config.$schema.split("/").at(-2) : undefined;
    if (manifestVersion !== mcpVersion) {
      fail(path, `Agent Plugins version must match ${manifestPath}`);
    }
  }

  if (!isPlainObject(config.mcpServers)) {
    fail(path, "`mcpServers` must be an object");
    return;
  }

  for (const [name, server] of Object.entries(config.mcpServers)) {
    if (!isPlainObject(server)) {
      fail(path, `server \`${name}\` must be an object`);
      continue;
    }
    const variant = typeof server.type === "string" ? SERVER_VARIANTS[server.type] : undefined;
    if (!variant) {
      fail(path, `server \`${name}\` has an unknown \`type\` (use stdio, streamable-http, or sse)`);
      continue;
    }
    const allowed = new Set([...variant.required, ...variant.optional]);
    for (const field of Object.keys(server)) {
      if (!allowed.has(field)) {
        fail(path, `server \`${name}\` has field \`${field}\`, which does not belong to \`${server.type}\``);
      }
    }
    for (const field of variant.required) {
      if (typeof server[field] !== "string") {
        fail(path, `server \`${name}\` is missing required string field \`${field}\``);
      }
    }
    if (typeof server.url === "string" && !/^https:\/\//.test(server.url) && !/^http:\/\/(localhost|127\.|\[::1\])/.test(server.url)) {
      fail(path, `server \`${name}\` must use an https URL (http is allowed only for loopback)`);
    }
  }
}

const pluginDirs = readdirSync("plugins", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join("plugins", entry.name));

let checked = 0;
for (const dir of pluginDirs) {
  const manifestPath = join(dir, "plugin.json");
  if (!existsSync(manifestPath)) {
    fail(dir, "is missing an Agent Plugins manifest (plugin.json)");
    continue;
  }
  validateManifest(manifestPath);
  checked += 1;

  const mcpPath = join(dir, "mcp.json");
  if (existsSync(mcpPath)) {
    validateMcpConfig(mcpPath, manifestPath);
    checked += 1;
  }
}

if (errors.length > 0) {
  console.error("Agent Plugins schema check failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Agent Plugins schema check passed (${checked} file${checked === 1 ? "" : "s"}).`);
