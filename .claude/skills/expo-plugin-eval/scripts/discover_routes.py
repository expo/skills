#!/usr/bin/env python3
"""Statically enumerate an Expo Router app's navigable routes (fallback).

Usage: discover_routes.py <project-path> [--pretty]
  <project-path>  The generated Expo app. Routes are read from app/ or src/app/.
  --pretty        Indent the JSON output.

Prints a JSON array of {"path","label","file"} to stdout, e.g.
  [{"path":"/","label":"Home","file":"app/(tabs)/index.tsx"}, ...]

This is the FALLBACK for when the executor did not emit its own routes.json.
The executor manifest is always preferred — it knows real sample values for
dynamic ([id]) routes, whereas this derives them by convention. Routes are
mapped with standard Expo Router rules:
  - index.*            -> the directory's route ("/" at the root)
  - (group)/           -> group dirs are transparent (stripped from the URL)
  - [param].*          -> dynamic; a sample value ("1") is substituted
  - [...rest].*        -> catch-all; a single sample segment is substituted
  - _layout.*          -> layout, not a route (skipped)
  - +not-found / +html / +api / +native-intent / any "+"-prefixed file -> skipped
Only .tsx/.ts/.jsx/.js files are considered. API route handlers (+api) and
non-route files are skipped so every emitted path renders a screen.
"""

import json
import sys
from pathlib import Path

ROUTE_EXTS = {".tsx", ".ts", ".jsx", ".js"}
SAMPLE_PARAM = "1"


def find_routes_dir(project):
    for candidate in (project / "app", project / "src" / "app"):
        if candidate.is_dir():
            return candidate
    return None


def is_route_file(p):
    if p.suffix not in ROUTE_EXTS:
        return False
    name = p.name
    stem = p.stem  # name without the final extension
    # Expo Router supports platform-suffixed files (index.ios.tsx); strip a
    # trailing .ios/.android/.web/.native so they collapse onto one route.
    base = stem
    for plat in (".ios", ".android", ".web", ".native"):
        if base.endswith(plat):
            base = base[: -len(plat)]
            break
    if base.startswith("+"):  # +not-found, +html, +api, +native-intent
        return False
    if base == "_layout":
        return False
    # +api route handlers (server endpoints) render no screen.
    if base.endswith("+api"):
        return False
    return True


def stem_base(p):
    """Route stem with any platform suffix and trailing extension removed."""
    base = p.stem
    for plat in (".ios", ".android", ".web", ".native"):
        if base.endswith(plat):
            return base[: -len(plat)]
    return base


def segment_to_url(seg):
    """Map one path segment to its URL form, or None to drop it."""
    if seg.startswith("(") and seg.endswith(")"):
        return None  # group dir — transparent to the URL
    if seg.startswith("[...") and seg.endswith("]"):
        return SAMPLE_PARAM  # catch-all
    if seg.startswith("[") and seg.endswith("]"):
        return SAMPLE_PARAM  # dynamic segment
    return seg


def humanize(route, segments):
    if route == "/":
        return "Home"
    # Prefer the last static (non-sampled) segment for a friendly label.
    for seg in reversed(segments):
        if seg.startswith("[") or seg.startswith("(") or seg == SAMPLE_PARAM:
            continue
        return seg.replace("-", " ").replace("_", " ").strip().title()
    # All-dynamic route: name it after the nearest static parent.
    return route.strip("/").replace("/", " ").title() or "Home"


def discover(project):
    routes_dir = find_routes_dir(project)
    if not routes_dir:
        return []

    seen = {}
    for p in sorted(routes_dir.rglob("*")):
        if not p.is_file() or not is_route_file(p):
            continue
        rel = p.relative_to(routes_dir)
        raw_segments = list(rel.parts[:-1]) + [stem_base(p)]
        if raw_segments and raw_segments[-1] == "index":
            raw_segments = raw_segments[:-1]  # index represents its parent dir

        url_segments = []
        ok = True
        for raw in raw_segments:
            mapped = segment_to_url(raw)
            if mapped is None:
                continue  # dropped group dir
            url_segments.append(mapped)

        route = "/" + "/".join(url_segments)
        route = "/" if route == "/" else route.rstrip("/")
        if not ok:
            continue
        if route not in seen:
            seen[route] = {
                "path": route,
                "label": humanize(route, raw_segments),
                "file": str(p.relative_to(project)),
            }

    # "/" first, then alphabetical — a stable order the snapshot loop relies on.
    routes = list(seen.values())
    routes.sort(key=lambda r: (r["path"] != "/", r["path"]))
    return routes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    pretty = "--pretty" in sys.argv
    if not args:
        print("usage: discover_routes.py <project-path> [--pretty]", file=sys.stderr)
        sys.exit(1)
    project = Path(args[0]).resolve()
    routes = discover(project)
    print(json.dumps(routes, indent=2 if pretty else None))


if __name__ == "__main__":
    main()
