"""
Type definitions for the Finance Agent Python SDK.
"""

from dataclasses import dataclass
from typing import Callable, Literal, Optional


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------

@dataclass
class FileInfo:
    fileName: str
    storedName: str
    type: str
    size: str
    uploadDate: str
    path: Optional[str] = None


@dataclass
class Message:
    id: str
    text: str
    sender: Literal["user", "agent"]
    timestamp: str


@dataclass
class Session:
    sessionId: str
    createdAt: str


# ---------------------------------------------------------------------------
# Literal union types (mirrors TypeScript union types)
# ---------------------------------------------------------------------------

WebSocketEvent = Literal[
    "connected",
    "userMessage",
    "agentMessage",
    "typingStart",
    "typingStop",
    "sessionReset",
    "messagesList",
    "newSession",
    "error",
]

WebSocketAction = Literal[
    "sendMessage",
    "getMessages",
    "getTypingStatus",
    "startNewSession",
]


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class FinanceAgentConfig:
    """Configuration options for the SDK.

    Args:
        base_url: Base URL of the Finance Agent API.
                  Example: ``'https://your-app.cfapps.eu10.hana.ondemand.com'``
        auth_token: Optional Bearer token used for authentication.
        headers: Optional extra HTTP headers sent with every request.
    """

    base_url: str
    auth_token: Optional[str] = None
    headers: Optional[dict[str, str]] = None


# ---------------------------------------------------------------------------
# Response types
# ---------------------------------------------------------------------------

@dataclass
class UploadFileResponse:
    message: str
    file: FileInfo


@dataclass
class GetFilesResponse:
    files: list[FileInfo]


@dataclass
class DeleteFileResponse:
    message: str


# ---------------------------------------------------------------------------
# WebSocket event handlers
# ---------------------------------------------------------------------------

@dataclass
class ChatEventHandlers:
    """Callbacks invoked when WebSocket events are received."""

    on_connected: Optional[Callable[[Session], None]] = None
    on_user_message: Optional[Callable[[Message], None]] = None
    on_agent_message: Optional[Callable[[Message], None]] = None
    on_typing_start: Optional[Callable[[], None]] = None
    on_typing_stop: Optional[Callable[[], None]] = None
    on_session_reset: Optional[Callable[[], None]] = None
    on_error: Optional[Callable[[str], None]] = None
