"""Pure journal retention helper tests."""

import pytest

from routes import journal


@pytest.fixture(autouse=True)
def cleanup_test_data():
    """Override backend DB cleanup for pure journal unit tests."""
    yield


def test_redacted_journal_data_removes_client_entered_metadata():
    redacted = journal._redacted_journal_data(
        {
            "started_as": "journal",
            "ai_feedback": True,
            "emotions": ["anxious"],
            "prompt_type": "free_write",
            "custom_detail": "private",
        }
    )

    assert redacted["raw_content_removed"] is True
    assert redacted["deleted_by"] == "client"
    assert redacted["started_as"] == "journal"
    assert redacted["ai_feedback"] is True
    assert journal.JOURNAL_DELETED_KEY in redacted
    assert "emotions" not in redacted
    assert "prompt_type" not in redacted
    assert "custom_detail" not in redacted


def test_deleted_journal_data_detection():
    assert journal._is_deleted_journal_data(
        {journal.JOURNAL_DELETED_KEY: "2026-04-25T00:00:00Z"}
    )
    assert not journal._is_deleted_journal_data({})
    assert not journal._is_deleted_journal_data(None)
