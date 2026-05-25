from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[3]
HARNESS_TOOLS = ROOT / "tools" / "harness"
if str(HARNESS_TOOLS) not in sys.path:
    sys.path.insert(0, str(HARNESS_TOOLS))

from error_memory import build_fingerprint, command_from_log, load_registry, record_failure, resolve_error  # noqa: E402


class ErrorMemoryTests(unittest.TestCase):
    def test_fingerprint_is_stable_for_same_failure(self):
        first = build_fingerprint("python -m unittest", 1, "AssertionError: expected grounded output", ["backend/tests/test.py"])
        second = build_fingerprint("python -m unittest", 1, "AssertionError: expected grounded output", ["backend/tests/test.py"])

        self.assertEqual(first, second)

    def test_record_failure_increments_occurrence_for_repeat(self):
        with tempfile.TemporaryDirectory() as tmp:
            registry_path = Path(tmp) / "registry.json"
            log = "Traceback\nAssertionError: expected grounded output\nbackend/tests/test.py:10"

            first, first_matched = record_failure("python -m unittest", 1, log, registry_path)
            second, second_matched = record_failure("python -m unittest", 1, log, registry_path)
            registry = load_registry(registry_path)

            self.assertFalse(first_matched)
            self.assertTrue(second_matched)
            self.assertEqual(first["id"], second["id"])
            self.assertEqual(second["occurrences"], 2)
            self.assertEqual(len(registry["errors"]), 1)

    def test_resolve_error_records_fix_and_guard(self):
        with tempfile.TemporaryDirectory() as tmp:
            registry_path = Path(tmp) / "registry.json"
            entry, _ = record_failure("python -m unittest", 1, "SyntaxError: invalid syntax", registry_path)

            resolved = resolve_error(
                entry["id"],
                "Fixed invalid syntax in harness script.",
                "python -m unittest discover -s tools/harness/tests",
                "A missing parenthesis broke import.",
                registry_path,
            )

            self.assertEqual(resolved["status"], "resolved")
            self.assertIn("invalid syntax", resolved["fix_summary"])
            self.assertIn("unittest", resolved["guard_test"])
            self.assertIn("parenthesis", resolved["root_cause"])

    def test_command_from_log_reads_runner_header(self):
        log = "$ python -m unittest backend.tests.contracts.test_agent_mvp_contracts\n# cwd: repo\n\nERROR"

        self.assertEqual(command_from_log(log), "python -m unittest backend.tests.contracts.test_agent_mvp_contracts")


if __name__ == "__main__":
    unittest.main()
