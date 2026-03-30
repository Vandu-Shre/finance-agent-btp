"""Tests for types.py – dataclass instantiation and defaults."""

import pytest
from finance_agent_sdk.types import (
    ChatEventHandlers,
    DeleteFileResponse,
    FileInfo,
    FinanceAgentConfig,
    GetFilesResponse,
    Message,
    Session,
    UploadFileResponse,
)


class TestFinanceAgentConfig:
    def test_required_base_url(self):
        cfg = FinanceAgentConfig(base_url="https://example.com")
        assert cfg.base_url == "https://example.com"

    def test_optional_fields_default_to_none(self):
        cfg = FinanceAgentConfig(base_url="https://example.com")
        assert cfg.auth_token is None
        assert cfg.headers is None

    def test_with_auth_token(self):
        cfg = FinanceAgentConfig(base_url="https://example.com", auth_token="tok123")
        assert cfg.auth_token == "tok123"

    def test_with_custom_headers(self):
        headers = {"X-Custom": "value"}
        cfg = FinanceAgentConfig(base_url="https://example.com", headers=headers)
        assert cfg.headers == {"X-Custom": "value"}


class TestFileInfo:
    def test_required_fields(self):
        fi = FileInfo(
            fileName="report.pdf",
            storedName="abc123.pdf",
            type="application/pdf",
            size="2048",
            uploadDate="2026-01-01T00:00:00Z",
        )
        assert fi.fileName == "report.pdf"
        assert fi.storedName == "abc123.pdf"
        assert fi.type == "application/pdf"
        assert fi.size == "2048"
        assert fi.uploadDate == "2026-01-01T00:00:00Z"

    def test_path_defaults_to_none(self):
        fi = FileInfo(
            fileName="f.pdf",
            storedName="s.pdf",
            type="application/pdf",
            size="100",
            uploadDate="2026-01-01",
        )
        assert fi.path is None

    def test_with_path(self):
        fi = FileInfo(
            fileName="f.pdf",
            storedName="s.pdf",
            type="application/pdf",
            size="100",
            uploadDate="2026-01-01",
            path="/uploads/s.pdf",
        )
        assert fi.path == "/uploads/s.pdf"


class TestMessage:
    def test_fields(self):
        msg = Message(id="1", text="Hello", sender="user", timestamp="2026-01-01T10:00:00Z")
        assert msg.id == "1"
        assert msg.text == "Hello"
        assert msg.sender == "user"
        assert msg.timestamp == "2026-01-01T10:00:00Z"

    def test_agent_sender(self):
        msg = Message(id="2", text="Hi there", sender="agent", timestamp="t")
        assert msg.sender == "agent"


class TestSession:
    def test_fields(self):
        session = Session(sessionId="sess-001", createdAt="2026-01-01T00:00:00Z")
        assert session.sessionId == "sess-001"
        assert session.createdAt == "2026-01-01T00:00:00Z"


class TestResponseTypes:
    def test_upload_file_response(self):
        fi = FileInfo("f.pdf", "s.pdf", "application/pdf", "100", "2026-01-01")
        resp = UploadFileResponse(message="Uploaded successfully", file=fi)
        assert resp.message == "Uploaded successfully"
        assert resp.file is fi

    def test_get_files_response(self):
        fi = FileInfo("f.pdf", "s.pdf", "application/pdf", "100", "2026-01-01")
        resp = GetFilesResponse(files=[fi])
        assert len(resp.files) == 1
        assert resp.files[0] is fi

    def test_delete_file_response(self):
        resp = DeleteFileResponse(message="Deleted")
        assert resp.message == "Deleted"


class TestChatEventHandlers:
    def test_all_defaults_none(self):
        h = ChatEventHandlers()
        assert h.on_connected is None
        assert h.on_user_message is None
        assert h.on_agent_message is None
        assert h.on_typing_start is None
        assert h.on_typing_stop is None
        assert h.on_session_reset is None
        assert h.on_error is None

    def test_set_callbacks(self):
        on_err = lambda e: None
        h = ChatEventHandlers(on_error=on_err)
        assert h.on_error is on_err
