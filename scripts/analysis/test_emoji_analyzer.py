import csv
import io
import os
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from scripts.analysis.emoji_analyzer import analyze_emoji_directory, main


class EmojiAnalyzerCliTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.png_dir = self.root / "2D" / "png" / "32"
        self.png_dir.mkdir(parents=True)
        (self.png_dir / "emoji_u00a9.png").touch()

    def assert_source(self, arguments, environment, expected):
        with patch.dict(os.environ, environment, clear=True):
            with patch("scripts.analysis.emoji_analyzer.analyze_emoji_directory") as analyze:
                main(arguments)
        analyze.assert_called_once_with(expected)

    def test_explicit_png_directory(self):
        self.assert_source(["--source", str(self.png_dir)], {}, self.png_dir)

    def test_environment_fallback(self):
        self.assert_source([], {"NOTO_EMOJI_DIR": str(self.png_dir)}, self.png_dir)

    def test_argument_overrides_environment(self):
        self.assert_source(
            ["--source", str(self.png_dir)],
            {"NOTO_EMOJI_DIR": str(self.root / "missing")},
            self.png_dir,
        )

    def test_checkout_root(self):
        self.assert_source(["--source", str(self.root)], {}, self.png_dir)

    def test_style_directory(self):
        self.assert_source(["--source", str(self.root / "2D")], {}, self.png_dir)

    def test_missing_configuration_reports_usage(self):
        output = io.StringIO()
        with patch.dict(os.environ, {}, clear=True), redirect_stderr(output):
            with self.assertRaises(SystemExit) as error:
                main([])
        self.assertEqual(error.exception.code, 2)
        self.assertIn("--source", output.getvalue())
        self.assertIn("NOTO_EMOJI_DIR", output.getvalue())

    def test_missing_or_empty_directory_reports_error(self):
        empty = self.root / "empty"
        empty.mkdir()
        for source in (self.root / "missing", empty, self.png_dir / "emoji_u00a9.png"):
            with self.subTest(source=source), redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error:
                    main(["--source", str(source)])
                self.assertEqual(error.exception.code, 2)

    def test_help_documents_environment_fallback(self):
        output = io.StringIO()
        with redirect_stdout(output):
            with self.assertRaises(SystemExit) as error:
                main(["--help"])
        self.assertEqual(error.exception.code, 0)
        self.assertIn("NOTO_EMOJI_DIR", output.getvalue())

    def test_analysis_writes_english_columns_and_status_values(self):
        (self.png_dir / "emoji_u00a9.png").unlink()
        opaque = self.png_dir / "active.png"
        transparent = self.png_dir / "inactive.png"
        Image.new("RGBA", (32, 32), (40, 80, 120, 255)).save(opaque)
        Image.new("RGBA", (32, 32), (0, 0, 0, 0)).save(transparent)
        output_csv = self.root / "analysis.csv"

        result = analyze_emoji_directory(self.png_dir, output_csv)

        expected_columns = [
            "filename", "srgb", "cielab", "transparency", "edge-density", "status", "reason",
        ]
        self.assertEqual(list(result.columns), expected_columns)
        self.assertEqual(
            result.set_index("filename")["status"].to_dict(),
            {"active.png": "active", "inactive.png": "inactive"},
        )
        with output_csv.open(newline="", encoding="utf-8") as csv_file:
            self.assertEqual(next(csv.reader(csv_file)), expected_columns)


if __name__ == "__main__":
    unittest.main()