"""Release regressions using real plist/PNG/IPA containers; no cloud calls."""

import json
from pathlib import Path
import plistlib
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
import zlib


CHECKER = Path(__file__).with_name("check-ios-release.py")


def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def png_fixture(alpha=False, transparency=False, size=1024):
    color = bytes((25, 40, 60, 255)) if alpha else bytes((25, 40, 60))
    pixels = (b"\0" + color * size) * size
    header = struct.pack(">IIBBBBB", size, size, 8, 6 if alpha else 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header)
            + (png_chunk(b"tRNS", bytes(6)) if transparency else b"")
            + png_chunk(b"IDAT", zlib.compress(pixels)) + png_chunk(b"IEND", b""))


class ReleaseChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / "Native App.app"
        self.app.mkdir()
        self.info = {
            "CFBundleIdentifier": "com.example.native",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "42",
            "CFBundleSupportedPlatforms": ["iPhoneOS"],
        }
        self.write_info()

    def write_info(self, binary=True):
        (self.app / "Info.plist").write_bytes(plistlib.dumps(
            self.info, fmt=plistlib.FMT_BINARY if binary else plistlib.FMT_XML))

    def run_check(self, artifact=None, icons=()):
        command = [sys.executable, str(CHECKER), str(artifact or self.app),
                   "--bundle-id", "com.example.native", "--build-number", "42", "--version", "1.0.0"]
        for icon in icons:
            command += ["--icon", str(icon)]
        return subprocess.run(command, text=True, capture_output=True)

    def test_device_app_and_rgb_icon(self):
        icon = self.root / "App Icon.png"
        icon.write_bytes(png_fixture())
        result = self.run_check(icons=[icon])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["flat_icons_checked"], 1)

    def test_xcarchive(self):
        archive = self.root / "Native.xcarchive"
        destination = archive / "Products/Applications/Native.app"
        destination.parent.mkdir(parents=True)
        self.app.rename(destination)
        result = self.run_check(archive)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_ipa_uses_main_app_not_extension(self):
        ipa = self.root / "Native.ipa"
        with zipfile.ZipFile(ipa, "w") as archive:
            archive.write(self.app / "Info.plist", "Payload/Native.app/Info.plist")
            archive.writestr("Payload/Native.app/PlugIns/Widget.appex/Info.plist",
                             plistlib.dumps({"CFBundleVersion": "different"}))
        result = self.run_check(ipa)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_stale_native_number_despite_remote_counter(self):
        self.info["CFBundleVersion"] = "1"
        self.write_info()
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expected '42', found '1'", result.stderr)

    def test_wrong_bundle_or_marketing_version(self):
        for key in ("CFBundleIdentifier", "CFBundleShortVersionString"):
            with self.subTest(key=key):
                original = self.info[key]
                self.info[key] = "different"
                self.write_info()
                result = self.run_check()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(key, result.stderr)
                self.info[key] = original

    def test_unresolved_or_missing_version(self):
        for value in ("$(CURRENT_PROJECT_VERSION)", "${CURRENT_PROJECT_VERSION}", None, 42):
            with self.subTest(value=value):
                if value is None:
                    self.info.pop("CFBundleVersion", None)
                else:
                    self.info["CFBundleVersion"] = value
                self.write_info(binary=False)
                result = self.run_check()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("CFBundleVersion", result.stderr)

    def test_simulator_is_not_a_store_artifact(self):
        self.info["CFBundleSupportedPlatforms"] = ["iPhoneSimulator"]
        self.write_info()
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("device iOS product", result.stderr)

    def test_all_opaque_rgba_still_rejected(self):
        icon = self.root / "RGBA.png"
        icon.write_bytes(png_fixture(alpha=True))
        result = self.run_check(icons=[icon])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("alpha channel", result.stderr)

    def test_transparency_chunk_rejected_even_without_alpha_samples(self):
        icon = self.root / "tRNS.png"
        icon.write_bytes(png_fixture(transparency=True))
        result = self.run_check(icons=[icon])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("tRNS", result.stderr)

    def test_small_or_truncated_icons(self):
        for data in (png_fixture(size=64), png_fixture()[:-5]):
            with self.subTest(length=len(data)):
                icon = self.root / "bad.png"
                icon.write_bytes(data)
                result = self.run_check(icons=[icon])
                self.assertNotEqual(result.returncode, 0)

    def test_multiple_main_apps_in_ipa_rejected(self):
        ipa = self.root / "ambiguous.ipa"
        with zipfile.ZipFile(ipa, "w") as archive:
            for name in ("One", "Two"):
                archive.writestr(f"Payload/{name}.app/Info.plist", plistlib.dumps(self.info))
        result = self.run_check(ipa)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("exactly one main", result.stderr)

    def test_corrupt_plist_and_ipa_report_errors(self):
        (self.app / "Info.plist").write_bytes(b'<?xml version="1.0"?><plist><dict>')
        ipa = self.root / "corrupt.ipa"
        ipa.write_bytes(b"not an archive")
        for artifact in (self.app, ipa):
            with self.subTest(artifact=artifact):
                result = self.run_check(artifact)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("ERROR:", result.stderr)
                self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
