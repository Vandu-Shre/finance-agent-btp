"""Tests for FileClient – HTTP-based file operations."""

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from finance_agent_sdk import FileClient, FinanceAgentConfig
from finance_agent_sdk.types import FileInfo, UploadFileResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FILE_INFO_DATA = {
    "fileName": "report.pdf",
    "storedName": "abc123.pdf",
    "type": "application/pdf",
    "size": "2048",
    "uploadDate": "2026-01-01T00:00:00Z",
}


def make_mock_response(json_data: dict, status_code: int = 200) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.is_success = status_code < 400
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.request = MagicMock()
    return resp


def mock_http_client(mock_http: AsyncMock):
    """Context manager patch for httpx.AsyncClient used in file_client."""
    patcher = patch("finance_agent_sdk.file_client.httpx.AsyncClient")

    class _Ctx:
        def __enter__(self_inner):
            cls = patcher.start()
            cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            cls.return_value.__aexit__ = AsyncMock(return_value=False)
            return cls

        def __exit__(self_inner, *args):
            patcher.stop()

    return _Ctx()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def config():
    return FinanceAgentConfig(base_url="https://example.com", auth_token="mytoken")


@pytest.fixture
def client(config):
    return FileClient(config)


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

class TestFileClientInit:
    def test_base_url_strips_trailing_slash(self):
        cfg = FinanceAgentConfig(base_url="https://example.com/")
        c = FileClient(cfg)
        assert c._base_url == "https://example.com"

    def test_base_url_without_trailing_slash(self):
        cfg = FinanceAgentConfig(base_url="https://example.com")
        c = FileClient(cfg)
        assert c._base_url == "https://example.com"

    def test_auth_token_added_to_headers(self, config):
        c = FileClient(config)
        assert c._headers["Authorization"] == "Bearer mytoken"

    def test_no_auth_token_no_authorization_header(self):
        cfg = FinanceAgentConfig(base_url="https://example.com")
        c = FileClient(cfg)
        assert "Authorization" not in c._headers

    def test_custom_headers_merged(self):
        cfg = FinanceAgentConfig(
            base_url="https://example.com",
            headers={"X-Tenant": "acme"},
        )
        c = FileClient(cfg)
        assert c._headers["X-Tenant"] == "acme"

    def test_custom_headers_and_auth_coexist(self):
        cfg = FinanceAgentConfig(
            base_url="https://example.com",
            auth_token="tok",
            headers={"X-Custom": "v"},
        )
        c = FileClient(cfg)
        assert c._headers["Authorization"] == "Bearer tok"
        assert c._headers["X-Custom"] == "v"

    def test_no_headers_defaults_to_empty(self):
        cfg = FinanceAgentConfig(base_url="https://example.com")
        c = FileClient(cfg)
        assert isinstance(c._headers, dict)


# ---------------------------------------------------------------------------
# get_files
# ---------------------------------------------------------------------------

class TestGetFiles:
    async def test_returns_list_of_file_info(self, client):
        mock_http = AsyncMock()
        mock_http.get.return_value = make_mock_response({"files": [FILE_INFO_DATA]})

        with mock_http_client(mock_http):
            result = await client.get_files()

        assert len(result) == 1
        fi = result[0]
        assert isinstance(fi, FileInfo)
        assert fi.fileName == "report.pdf"
        assert fi.storedName == "abc123.pdf"
        assert fi.type == "application/pdf"
        assert fi.size == "2048"
        assert fi.uploadDate == "2026-01-01T00:00:00Z"

    async def test_returns_empty_list_when_no_files(self, client):
        mock_http = AsyncMock()
        mock_http.get.return_value = make_mock_response({"files": []})

        with mock_http_client(mock_http):
            result = await client.get_files()

        assert result == []

    async def test_returns_multiple_files(self, client):
        mock_http = AsyncMock()
        mock_http.get.return_value = make_mock_response(
            {"files": [FILE_INFO_DATA, {**FILE_INFO_DATA, "fileName": "other.csv"}]}
        )

        with mock_http_client(mock_http):
            result = await client.get_files()

        assert len(result) == 2

    async def test_calls_correct_url(self, client):
        mock_http = AsyncMock()
        mock_http.get.return_value = make_mock_response({"files": []})

        with mock_http_client(mock_http):
            await client.get_files()

        mock_http.get.assert_called_once_with(
            "https://example.com/api/files",
            headers=client._headers,
        )

    async def test_raises_on_http_error(self, client):
        mock_http = AsyncMock()
        mock_http.get.return_value = make_mock_response({"error": "Unauthorized"}, 401)

        with mock_http_client(mock_http):
            with pytest.raises(httpx.HTTPStatusError):
                await client.get_files()

    async def test_raises_on_server_error(self, client):
        mock_http = AsyncMock()
        mock_http.get.return_value = make_mock_response({}, 500)

        with mock_http_client(mock_http):
            with pytest.raises(httpx.HTTPStatusError):
                await client.get_files()

    async def test_file_info_optional_path(self, client):
        data_with_path = {**FILE_INFO_DATA, "path": "/storage/abc123.pdf"}
        mock_http = AsyncMock()
        mock_http.get.return_value = make_mock_response({"files": [data_with_path]})

        with mock_http_client(mock_http):
            result = await client.get_files()

        assert result[0].path == "/storage/abc123.pdf"

    async def test_file_info_path_none_when_absent(self, client):
        mock_http = AsyncMock()
        mock_http.get.return_value = make_mock_response({"files": [FILE_INFO_DATA]})

        with mock_http_client(mock_http):
            result = await client.get_files()

        assert result[0].path is None


# ---------------------------------------------------------------------------
# upload_file
# ---------------------------------------------------------------------------

class TestUploadFile:
    async def test_upload_from_path(self, client, tmp_path):
        f = tmp_path / "document.pdf"
        f.write_bytes(b"PDF content here")

        mock_http = AsyncMock()
        mock_http.post.return_value = make_mock_response(
            {"message": "Uploaded", "file": FILE_INFO_DATA}
        )

        with mock_http_client(mock_http):
            result = await client.upload_file(f)

        assert isinstance(result, UploadFileResponse)
        assert result.message == "Uploaded"
        assert result.file.fileName == "report.pdf"

    async def test_upload_from_string_path(self, client, tmp_path):
        f = tmp_path / "data.csv"
        f.write_bytes(b"col1,col2\n1,2")

        mock_http = AsyncMock()
        mock_http.post.return_value = make_mock_response(
            {"message": "ok", "file": FILE_INFO_DATA}
        )

        with mock_http_client(mock_http):
            result = await client.upload_file(str(f))

        assert result.message == "ok"

    async def test_upload_from_bytes_with_filename(self, client):
        mock_http = AsyncMock()
        mock_http.post.return_value = make_mock_response(
            {"message": "Uploaded bytes", "file": FILE_INFO_DATA}
        )

        with mock_http_client(mock_http):
            result = await client.upload_file(b"raw content", filename="data.bin")

        assert result.message == "Uploaded bytes"

    async def test_upload_bytes_without_filename_raises(self, client):
        with pytest.raises(ValueError, match="filename"):
            await client.upload_file(b"raw content")

    async def test_upload_uses_path_filename_when_no_override(self, client, tmp_path):
        f = tmp_path / "myfile.txt"
        f.write_bytes(b"hello")

        mock_http = AsyncMock()
        mock_http.post.return_value = make_mock_response(
            {"message": "ok", "file": FILE_INFO_DATA}
        )

        with mock_http_client(mock_http):
            await client.upload_file(f)

        call_kwargs = mock_http.post.call_args.kwargs
        assert call_kwargs["files"]["file"][0] == "myfile.txt"

    async def test_upload_filename_override_takes_precedence(self, client, tmp_path):
        f = tmp_path / "original.txt"
        f.write_bytes(b"content")

        mock_http = AsyncMock()
        mock_http.post.return_value = make_mock_response(
            {"message": "ok", "file": FILE_INFO_DATA}
        )

        with mock_http_client(mock_http):
            await client.upload_file(f, filename="renamed.txt")

        call_kwargs = mock_http.post.call_args.kwargs
        assert call_kwargs["files"]["file"][0] == "renamed.txt"

    async def test_upload_calls_correct_url(self, client, tmp_path):
        f = tmp_path / "f.pdf"
        f.write_bytes(b"x")

        mock_http = AsyncMock()
        mock_http.post.return_value = make_mock_response(
            {"message": "ok", "file": FILE_INFO_DATA}
        )

        with mock_http_client(mock_http):
            await client.upload_file(f)

        call_args = mock_http.post.call_args
        assert call_args.args[0] == "https://example.com/api/files"

    async def test_upload_raises_on_http_error(self, client, tmp_path):
        f = tmp_path / "f.txt"
        f.write_bytes(b"x")

        mock_http = AsyncMock()
        mock_http.post.return_value = make_mock_response({"error": "Too large"}, 413)

        with mock_http_client(mock_http):
            with pytest.raises(httpx.HTTPStatusError):
                await client.upload_file(f)

    async def test_upload_file_content_is_bytes(self, client, tmp_path):
        f = tmp_path / "sample.pdf"
        f.write_bytes(b"PDF bytes")

        mock_http = AsyncMock()
        mock_http.post.return_value = make_mock_response(
            {"message": "ok", "file": FILE_INFO_DATA}
        )

        with mock_http_client(mock_http):
            await client.upload_file(f)

        call_kwargs = mock_http.post.call_args.kwargs
        assert call_kwargs["files"]["file"][1] == b"PDF bytes"


# ---------------------------------------------------------------------------
# delete_file
# ---------------------------------------------------------------------------

class TestDeleteFile:
    async def test_delete_returns_confirmation_message(self, client):
        mock_http = AsyncMock()
        mock_http.delete.return_value = make_mock_response({"message": "File deleted"})

        with mock_http_client(mock_http):
            result = await client.delete_file("abc123.pdf")

        assert result == "File deleted"

    async def test_delete_url_encodes_filename(self, client):
        mock_http = AsyncMock()
        mock_http.delete.return_value = make_mock_response({"message": "ok"})

        with mock_http_client(mock_http):
            await client.delete_file("my file (1).pdf")

        url = mock_http.delete.call_args.args[0]
        assert "my%20file%20%281%29.pdf" in url

    async def test_delete_url_encodes_special_characters(self, client):
        mock_http = AsyncMock()
        mock_http.delete.return_value = make_mock_response({"message": "ok"})

        with mock_http_client(mock_http):
            await client.delete_file("file@domain.com")

        url = mock_http.delete.call_args.args[0]
        assert "file%40domain.com" in url

    async def test_delete_calls_correct_base_url(self, client):
        mock_http = AsyncMock()
        mock_http.delete.return_value = make_mock_response({"message": "ok"})

        with mock_http_client(mock_http):
            await client.delete_file("abc.pdf")

        url = mock_http.delete.call_args.args[0]
        assert url.startswith("https://example.com/api/files/")

    async def test_delete_raises_on_not_found(self, client):
        mock_http = AsyncMock()
        mock_http.delete.return_value = make_mock_response({"error": "Not found"}, 404)

        with mock_http_client(mock_http):
            with pytest.raises(httpx.HTTPStatusError):
                await client.delete_file("nonexistent.pdf")

    async def test_delete_raises_on_server_error(self, client):
        mock_http = AsyncMock()
        mock_http.delete.return_value = make_mock_response({}, 500)

        with mock_http_client(mock_http):
            with pytest.raises(httpx.HTTPStatusError):
                await client.delete_file("f.pdf")

    async def test_delete_empty_message_when_missing_key(self, client):
        mock_http = AsyncMock()
        mock_http.delete.return_value = make_mock_response({})

        with mock_http_client(mock_http):
            result = await client.delete_file("f.pdf")

        assert result == ""
