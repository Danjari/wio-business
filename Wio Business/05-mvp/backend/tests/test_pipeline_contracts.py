from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import patch

import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from pipeline import categorize_llm, llm_vision, orchestrate
from pipeline.extract import ExtractResult


class VisionExtractionTests(unittest.TestCase):
    def test_vision_parse_preserves_currency(self) -> None:
        result = llm_vision._parse(
            '{"merchant":"Cafe Nero","total":12.5,"currency":"USD","date":"2026-06-29","confidence":0.99}'
        )

        self.assertEqual(result.currency, "USD")

    def test_vision_missing_api_key_is_controlled_runtime_error(self) -> None:
        with NamedTemporaryFile(suffix=".jpg") as tmp:
            with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
                with self.assertRaisesRegex(RuntimeError, "GEMINI_API_KEY"):
                    llm_vision.extract_from_image(tmp.name)


class PipelineOrchestrationTests(unittest.TestCase):
    def test_direct_vision_fallback_uses_vision_currency(self) -> None:
        vision_result = llm_vision.LLMVisionResult(
            merchant="Cafe Nero",
            total=12.5,
            currency="USD",
            date="2026-06-29",
            confidence=0.99,
        )

        with (
            patch.object(orchestrate.extract, "extract_receipt", side_effect=RuntimeError("textract down")),
            patch.object(orchestrate.llm_vision, "extract_from_image", return_value=vision_result),
            patch.object(orchestrate.categorize_llm, "categorize", return_value=("Meals & Entertainment", 0.99)),
            patch.object(orchestrate.match, "find_match", return_value=None),
        ):
            result = orchestrate.run(
                receipt_id="receipt_1",
                image_path="/tmp/receipt.jpg",
                transactions=[],
                db=None,
            )

        self.assertEqual(result.status, "unmatched_routed")
        self.assertEqual(result.currency, "USD")

    def test_unmatched_receipt_without_date_needs_clarity(self) -> None:
        textract_result = ExtractResult(
            merchant="Cafe Nero",
            total=42.0,
            currency="AED",
            date=None,
            total_confidence=99.0,
        )
        notifications: list[str] = []

        with (
            patch.object(orchestrate.extract, "extract_receipt", return_value=textract_result),
            patch.object(orchestrate.categorize_llm, "categorize", return_value=("Meals & Entertainment", 0.99)),
            patch.object(orchestrate.match, "find_match", return_value=None),
        ):
            result = orchestrate.run(
                receipt_id="receipt_1",
                image_path="/tmp/receipt.jpg",
                transactions=[],
                db=None,
                bot_notify_fn=notifications.append,
            )

        self.assertEqual(result.status, "needs_clarity")
        self.assertIn("date", notifications[0])


class LLMCategorizationTests(unittest.TestCase):
    def test_missing_api_key_returns_default_category(self) -> None:
        with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
            self.assertEqual(categorize_llm.categorize("Cafe Nero"), ("Other", 0.5))
            self.assertEqual(categorize_llm.categorize_batch([{"merchant": "Cafe Nero"}]), ["Other"])


class SchemaContractTests(unittest.TestCase):
    def test_receipts_schema_supports_slack_duplicate_check(self) -> None:
        schema = (BACKEND_DIR / "supabase" / "schema.sql").read_text()

        self.assertIn("slack_file_id", schema)
        self.assertIn("idx_receipts_slack_file_id", schema)

    def test_transactions_schema_supports_currency_used_by_pipeline(self) -> None:
        schema = (BACKEND_DIR / "supabase" / "schema.sql").read_text()

        self.assertIn("currency    TEXT NOT NULL DEFAULT 'AED'", schema)
        self.assertIn("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency", schema)


if __name__ == "__main__":
    unittest.main()
