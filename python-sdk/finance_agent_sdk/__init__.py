"""
Finance Agent Python SDK
========================

A Python equivalent of the TypeScript SDK, providing async clients for the
Finance Agent file API (HTTP) and chat API (WebSocket).

Quick start::

    import asyncio
    from finance_agent_sdk import FinanceAgentSDK, FinanceAgentConfig
    from finance_agent_sdk.types import ChatEventHandlers

    async def main():
        sdk = FinanceAgentSDK(FinanceAgentConfig(
            base_url="https://your-app.example.com",
            auth_token="<optional-token>",
        ))

        # File operations
        files = await sdk.files.get_files()
        print(files)

        # Chat
        handlers = ChatEventHandlers(
            on_agent_message=lambda msg: print("Agent:", msg.text),
        )
        await sdk.chat.connect(handlers)
        sdk.chat.send_message("What is my account balance?")
        await asyncio.sleep(10)
        sdk.chat.disconnect()

    asyncio.run(main())
"""

from .chat_client import ChatClient
from .file_client import FileClient
from .types import (
    ChatEventHandlers,
    DeleteFileResponse,
    FileInfo,
    FinanceAgentConfig,
    GetFilesResponse,
    Message,
    Session,
    UploadFileResponse,
    WebSocketAction,
    WebSocketEvent,
)

__all__ = [
    # Main SDK entry point
    "FinanceAgentSDK",
    # Sub-clients
    "FileClient",
    "ChatClient",
    # Config & types
    "FinanceAgentConfig",
    "FileInfo",
    "Message",
    "Session",
    "UploadFileResponse",
    "GetFilesResponse",
    "DeleteFileResponse",
    "ChatEventHandlers",
    "WebSocketEvent",
    "WebSocketAction",
]


class FinanceAgentSDK:
    """Main entry point for the Finance Agent SDK.

    Attributes:
        files: :class:`FileClient` for file upload/list/delete operations.
        chat:  :class:`ChatClient` for WebSocket-based chat.
    """

    def __init__(self, config: FinanceAgentConfig) -> None:
        self.files = FileClient(config)
        self.chat = ChatClient(config)
