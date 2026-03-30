"""
File API Client – handles file upload, listing, and deletion.
Uses ``httpx`` for async HTTP requests.
"""

from __future__ import annotations

from pathlib import Path
from typing import Union
from urllib.parse import quote

import httpx

from .types import FileInfo, FinanceAgentConfig, UploadFileResponse


class FileClient:
    """Async client for the Finance Agent file API."""

    def __init__(self, config: FinanceAgentConfig) -> None:
        self._base_url = config.base_url.rstrip("/")
        self._headers: dict[str, str] = dict(config.headers or {})
        if config.auth_token:
            self._headers["Authorization"] = f"Bearer {config.auth_token}"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def upload_file(
        self,
        source: Union[str, Path, bytes],
        *,
        filename: str | None = None,
    ) -> UploadFileResponse:
        """Upload a file to the server.

        Args:
            source: A file-system path (``str`` / ``Path``) **or** raw
                    ``bytes`` content.  When passing bytes, *filename* must
                    also be provided.
            filename: Override or supply the filename sent in the multipart
                      request.  Required when *source* is ``bytes``.

        Returns:
            :class:`UploadFileResponse` containing the upload message and
            :class:`FileInfo` for the stored file.

        Raises:
            ValueError: When *source* is ``bytes`` but *filename* is omitted.
            httpx.HTTPStatusError: On a non-2xx response.
        """
        if isinstance(source, (str, Path)):
            path = Path(source)
            content = path.read_bytes()
            name = filename or path.name
        else:
            content = source
            if not filename:
                raise ValueError("'filename' is required when 'source' is bytes")
            name = filename

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/api/files",
                headers=self._headers,
                files={"file": (name, content)},
            )

        if not response.is_success:
            error = _extract_error(response, "Failed to upload file")
            raise httpx.HTTPStatusError(error, request=response.request, response=response)

        data = response.json()
        return UploadFileResponse(
            message=data["message"],
            file=_parse_file_info(data["file"]),
        )

    async def get_files(self) -> list[FileInfo]:
        """Retrieve the list of all uploaded files.

        Returns:
            A list of :class:`FileInfo` objects.

        Raises:
            httpx.HTTPStatusError: On a non-2xx response.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/api/files",
                headers=self._headers,
            )

        if not response.is_success:
            error = _extract_error(response, "Failed to get files")
            raise httpx.HTTPStatusError(error, request=response.request, response=response)

        return [_parse_file_info(f) for f in response.json().get("files", [])]

    async def delete_file(self, filename: str) -> str:
        """Delete a file by its stored name.

        Args:
            filename: The ``storedName`` of the file to delete.

        Returns:
            Confirmation message from the server.

        Raises:
            httpx.HTTPStatusError: On a non-2xx response.
        """
        encoded = quote(filename, safe="")
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self._base_url}/api/files/{encoded}",
                headers=self._headers,
            )

        if not response.is_success:
            error = _extract_error(response, "Failed to delete file")
            raise httpx.HTTPStatusError(error, request=response.request, response=response)

        return response.json().get("message", "")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_file_info(data: dict) -> FileInfo:
    return FileInfo(
        fileName=data["fileName"],
        storedName=data["storedName"],
        type=data["type"],
        size=data["size"],
        uploadDate=data["uploadDate"],
        path=data.get("path"),
    )


def _extract_error(response: httpx.Response, fallback: str) -> str:
    try:
        return response.json().get("error", fallback)
    except Exception:
        return f"{fallback} (status {response.status_code})"
