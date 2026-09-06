#!/usr/bin/env python3
"""Check an iOS product's release metadata and selected flat PNG app icons."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import plistlib
import struct
import sys
import zipfile
import zlib
from xml.parsers.expat import ExpatError


def read_app_info(artifact: Path) -> dict:
    if artifact.suffix == ".ipa":
        with zipfile.ZipFile(artifact) as archive:
            names = [
                name for name in archive.namelist()
                if name.startswith("Payload/") and name.endswith(".app/Info.plist")
                and name.count("/") == 2
            ]
            if len(names) != 1:
                raise ValueError("IPA must contain exactly one main Payload/*.app/Info.plist")
            info = plistlib.loads(archive.read(names[0]))
    else:
        if artifact.suffix == ".app":
            candidates = [artifact / "Info.plist"]
        elif artifact.suffix == ".xcarchive":
            candidates = list((artifact / "Products/Applications").glob("*.app/Info.plist"))
        else:
            raise ValueError("Provide a built .app, .xcarchive, or exported .ipa")
        if len(candidates) != 1:
            raise ValueError("Archive must contain exactly one main app")
        info = plistlib.loads(candidates[0].read_bytes())
    if not isinstance(info, dict):
        raise ValueError("Main app Info.plist must be a dictionary")
    return info


def check_flat_icon(icon: Path) -> None:
    data = icon.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG file")
    position = 8
    dimensions = None
    has_pixels = False
    complete = False
    while position + 12 <= len(data):
        length = struct.unpack_from(">I", data, position)[0]
        kind = data[position + 4:position + 8]
        end = position + 12 + length
        if end > len(data):
            raise ValueError("truncated PNG chunk")
        payload = data[position + 8:end - 4]
        crc = struct.unpack_from(">I", data, end - 4)[0]
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != crc:
            raise ValueError("invalid PNG chunk checksum")
        if position == 8 and kind != b"IHDR":
            raise ValueError("PNG must start with IHDR")
        if kind == b"IHDR":
            if length != 13 or dimensions is not None:
                raise ValueError("invalid PNG header")
            width, height, _, color_type, _, _, _ = struct.unpack(">IIBBBBB", payload)
            dimensions = (width, height)
            if color_type in (4, 6):
                raise ValueError("contains an alpha channel, including when every pixel is opaque")
        elif kind == b"tRNS":
            raise ValueError("contains PNG transparency (tRNS)")
        elif kind == b"IDAT":
            has_pixels = has_pixels or length > 0
        elif kind == b"IEND":
            complete = length == 0
            break
        position = end
    if not complete or not has_pixels or dimensions is None:
        raise ValueError("incomplete PNG")
    if dimensions != (1024, 1024):
        raise ValueError(f"flat AppIcon must be 1024x1024; found {dimensions[0]}x{dimensions[1]}")


def check_metadata(info: dict, bundle_id: str, build_number: str, version: str | None) -> list[str]:
    issues = []
    expected = {"CFBundleIdentifier": bundle_id, "CFBundleVersion": build_number}
    if version is not None:
        expected["CFBundleShortVersionString"] = version
    for key in ("CFBundleIdentifier", "CFBundleVersion", "CFBundleShortVersionString"):
        actual = info.get(key)
        if not isinstance(actual, str) or not actual or "$(" in actual or "${" in actual:
            issues.append(f"{key} must be a resolved, nonempty string; found {actual!r}")
        elif key in expected and actual != expected[key]:
            issues.append(f"{key}: expected {expected[key]!r}, found {actual!r}")
    platforms = info.get("CFBundleSupportedPlatforms")
    if platforms != ["iPhoneOS"]:
        issues.append(f"Expected a device iOS product; CFBundleSupportedPlatforms is {platforms!r}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path, help="Built .app, .xcarchive, or exported .ipa")
    parser.add_argument("--bundle-id", required=True)
    parser.add_argument("--build-number", required=True, help="Expected number for this exact build")
    parser.add_argument("--version", help="Expected marketing version")
    parser.add_argument("--icon", type=Path, action="append", default=[],
                        help="Selected 1024px flat AppIcon PNG; repeat as needed, not for .icon layers")
    args = parser.parse_args()
    try:
        info = read_app_info(args.artifact)
    except (OSError, ValueError, plistlib.InvalidFileException, zipfile.BadZipFile, ExpatError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    issues = check_metadata(info, args.bundle_id, args.build_number, args.version)
    for icon in args.icon:
        try:
            check_flat_icon(icon)
        except (OSError, ValueError) as error:
            issues.append(f"{icon}: {error}")
    if issues:
        for issue in issues:
            print(f"ERROR: {issue}", file=sys.stderr)
        return 1
    print(json.dumps({
        "bundle_id": info["CFBundleIdentifier"],
        "version": info["CFBundleShortVersionString"],
        "build_number": info["CFBundleVersion"],
        "platform": "iPhoneOS",
        "flat_icons_checked": len(args.icon),
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
