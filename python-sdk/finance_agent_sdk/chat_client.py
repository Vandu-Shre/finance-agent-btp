"""
Chat API Client – WebSocket-based chat communication.
Uses ``websockets`` for async WebSocket handling.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import websockets
from websockets.asyncio.client import ClientConnection

from .types import ChatEventHandlers, FinanceAgentConfig, Message, Session

logger = logging.getLogger(__name__)


class ChatClient:
    """Async WebSocket client for the Finance Agent chat API.

    Usage example::

        import asyncio
        from finance_agent_sdk import FinanceAgentConfig, ChatClient
        from finance_agent_sdk.types import ChatEventHandlers

        async def main():
            config = FinanceAgentConfig(base_url="https://your-app.example.com")
            client = ChatClient(config)

            handlers = ChatEventHandlers(
                on_agent_message=lambda msg: print("Agent:", msg.text),
            )
            await client.connect(handlers)
            client.send_message("Hello!")
            await asyncio.sleep(5)
            client.disconnect()

        asyncio.run(main())
    """

    def __init__(self, config: FinanceAgentConfig) -> None:
        base_url = config.base_url.rstrip("/")
        # Convert http(s) → ws(s)
        self._ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://") + "/api/chat"
        self._auth_token: Optional[str] = config.auth_token
        self._ws: Optional[ClientConnection] = None
        self._handlers: ChatEventHandlers = ChatEventHandlers()
        self._listener_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, handlers: ChatEventHandlers | None = None) -> None:
        """Connect to the chat WebSocket and start listening for messages.

        Args:
            handlers: Optional :class:`ChatEventHandlers` with callbacks for
                      each WebSocket event type.

        Raises:
            websockets.exceptions.WebSocketException: On connection failure.
        """
        self._handlers = handlers or ChatEventHandlers()

        extra_headers: dict[str, str] = {}
        if self._auth_token:
            extra_headers["Authorization"] = f"Bearer {self._auth_token}"

        self._ws = await websockets.connect(self._ws_url, additional_headers=extra_headers)
        logger.info("WebSocket connected to %s", self._ws_url)

        # Start background listener
        self._listener_task = asyncio.create_task(self._listen())

    def disconnect(self) -> None:
        """Disconnect from the WebSocket (schedules close on the event loop)."""
        if self._listener_task:
            self._listener_task.cancel()
            self._listener_task = None
        if self._ws:
            asyncio.ensure_future(self._ws.close())
            self._ws = None
            logger.info("WebSocket disconnected")

    @property
    def is_connected(self) -> bool:
        """``True`` when the WebSocket connection is open."""
        return self._ws is not None and not self._ws.closed

    # ------------------------------------------------------------------
    # Sending actions
    # ------------------------------------------------------------------

    def send_message(self, text: str) -> None:
        """Send a chat message.

        Args:
            text: Message text to send.

        Raises:
            RuntimeError: If the WebSocket is not connected.
        """
        self._send({"action": "sendMessage", "text": text})

    def get_messages(self) -> None:
        """Request all messages from the server."""
        self._send({"action": "getMessages"})

    def get_typing_status(self) -> None:
        """Request the current typing status."""
        self._send({"action": "getTypingStatus"})

    def start_new_session(self) -> None:
        """Ask the server to create a new chat session."""
        self._send({"action": "startNewSession"})

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _send(self, payload: dict) -> None:
        if not self.is_connected or self._ws is None:
            raise RuntimeError("WebSocket is not connected")
        asyncio.ensure_future(self._ws.send(json.dumps(payload)))

    async def _listen(self) -> None:
        """Background coroutine that receives and dispatches WebSocket messages."""
        assert self._ws is not None
        try:
            async for raw in self._ws:
                try:
                    envelope = json.loads(raw)
                    self._dispatch(envelope.get("event"), envelope.get("data"))
                except (json.JSONDecodeError, KeyError) as exc:
                    logger.error("Error parsing WebSocket message: %s", exc)
        except asyncio.CancelledError:
            pass
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
            self._ws = None

    def _dispatch(self, event: str | None, data: dict | None) -> None:
        data = data or {}
        h = self._handlers

        if event == "connected":
            if h.on_connected:
                session_data = data.get("session", {})
                h.on_connected(Session(
                    sessionId=session_data.get("sessionId", ""),
                    createdAt=session_data.get("createdAt", ""),
                ))
        elif event == "userMessage":
            if h.on_user_message:
                h.on_user_message(_parse_message(data))
        elif event == "agentMessage":
            if h.on_agent_message:
                h.on_agent_message(_parse_message(data))
        elif event == "typingStart":
            if h.on_typing_start:
                h.on_typing_start()
        elif event == "typingStop":
            if h.on_typing_stop:
                h.on_typing_stop()
        elif event == "sessionReset":
            if h.on_session_reset:
                h.on_session_reset()
        elif event == "messagesList":
            logger.debug("Received messages list: %s", data.get("messages"))
        elif event == "newSession":
            logger.debug("New session created: %s", data)
        elif event == "error":
            if h.on_error:
                h.on_error(data.get("error", "Unknown error"))
        else:
            logger.warning("Unknown WebSocket event: %s", event)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_message(data: dict) -> Message:
    return Message(
        id=data.get("id", ""),
        text=data.get("text", ""),
        sender=data.get("sender", "agent"),
        timestamp=data.get("timestamp", ""),
    )
