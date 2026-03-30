"""Tests for ChatClient – WebSocket-based chat communication."""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call

from finance_agent_sdk import ChatClient, FinanceAgentConfig
from finance_agent_sdk.types import ChatEventHandlers, Message, Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_mock_ws(messages=()):
    """Return a mock WebSocket that yields the given raw string messages."""
    mock_ws = MagicMock()
    mock_ws.closed = False
    mock_ws.send = AsyncMock()
    mock_ws.close = AsyncMock()

    msg_list = list(messages)

    async def _aiter():
        for msg in msg_list:
            yield msg

    mock_ws.__aiter__ = lambda *_: _aiter()
    return mock_ws


def patch_connect(mock_ws):
    """Patch websockets.connect to return mock_ws when awaited."""
    return patch(
        "finance_agent_sdk.chat_client.websockets.connect",
        new_callable=AsyncMock,
        return_value=mock_ws,
    )


async def setup_connected_client(client, mock_ws=None):
    """Connect client using a mock WebSocket; listener task is suppressed."""
    if mock_ws is None:
        mock_ws = make_mock_ws()
    with patch_connect(mock_ws), \
         patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=MagicMock()):
        await client.connect()
    return mock_ws


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def config():
    return FinanceAgentConfig(base_url="https://example.com", auth_token="mytoken")


@pytest.fixture
def client(config):
    return ChatClient(config)


@pytest.fixture
def config_no_auth():
    return FinanceAgentConfig(base_url="https://example.com")


@pytest.fixture
def client_no_auth(config_no_auth):
    return ChatClient(config_no_auth)


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

class TestChatClientInit:
    def test_http_url_converted_to_ws(self):
        cfg = FinanceAgentConfig(base_url="http://example.com")
        c = ChatClient(cfg)
        assert c._ws_url == "ws://example.com/api/chat"

    def test_https_url_converted_to_wss(self):
        cfg = FinanceAgentConfig(base_url="https://example.com")
        c = ChatClient(cfg)
        assert c._ws_url == "wss://example.com/api/chat"

    def test_trailing_slash_stripped_before_conversion(self):
        cfg = FinanceAgentConfig(base_url="https://example.com/")
        c = ChatClient(cfg)
        assert c._ws_url == "wss://example.com/api/chat"

    def test_api_chat_path_appended(self):
        cfg = FinanceAgentConfig(base_url="https://example.com")
        c = ChatClient(cfg)
        assert c._ws_url.endswith("/api/chat")

    def test_auth_token_stored(self, client):
        assert client._auth_token == "mytoken"

    def test_no_auth_token_is_none(self, client_no_auth):
        assert client_no_auth._auth_token is None

    def test_initially_not_connected(self, client):
        assert client._ws is None
        assert client._listener_task is None

    def test_is_connected_false_initially(self, client):
        assert not client.is_connected


# ---------------------------------------------------------------------------
# connect()
# ---------------------------------------------------------------------------

class TestConnect:
    async def test_connect_sets_ws_attribute(self, client):
        mock_ws = make_mock_ws()
        with patch_connect(mock_ws), \
             patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=MagicMock()):
            await client.connect()
        assert client._ws is mock_ws

    async def test_connect_passes_auth_header(self, client):
        mock_ws = make_mock_ws()
        with patch_connect(mock_ws) as mock_connect, \
             patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=MagicMock()):
            await client.connect()
        _, kwargs = mock_connect.call_args
        assert kwargs["additional_headers"] == {"Authorization": "Bearer mytoken"}

    async def test_connect_no_auth_empty_headers(self, client_no_auth):
        mock_ws = make_mock_ws()
        with patch_connect(mock_ws) as mock_connect, \
             patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=MagicMock()):
            await client_no_auth.connect()
        _, kwargs = mock_connect.call_args
        assert kwargs["additional_headers"] == {}

    async def test_connect_starts_listener_task(self, client):
        mock_ws = make_mock_ws()
        mock_task = MagicMock()
        with patch_connect(mock_ws), \
             patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=mock_task) as mock_ct:
            await client.connect()
        mock_ct.assert_called_once()
        assert client._listener_task is mock_task

    async def test_connect_sets_handlers(self, client):
        mock_ws = make_mock_ws()
        handlers = ChatEventHandlers(on_typing_start=lambda: None)
        with patch_connect(mock_ws), \
             patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=MagicMock()):
            await client.connect(handlers)
        assert client._handlers is handlers

    async def test_connect_no_handlers_uses_defaults(self, client):
        mock_ws = make_mock_ws()
        with patch_connect(mock_ws), \
             patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=MagicMock()):
            await client.connect()
        assert isinstance(client._handlers, ChatEventHandlers)

    async def test_connect_calls_correct_ws_url(self, client):
        mock_ws = make_mock_ws()
        with patch_connect(mock_ws) as mock_connect, \
             patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=MagicMock()):
            await client.connect()
        args, _ = mock_connect.call_args
        assert args[0] == "wss://example.com/api/chat"


# ---------------------------------------------------------------------------
# disconnect()
# ---------------------------------------------------------------------------

class TestDisconnect:
    async def test_disconnect_clears_ws(self, client):
        await setup_connected_client(client)
        client.disconnect()
        assert client._ws is None

    async def test_disconnect_clears_listener_task(self, client):
        await setup_connected_client(client)
        client.disconnect()
        assert client._listener_task is None

    async def test_disconnect_cancels_listener_task(self, client):
        mock_task = MagicMock()
        mock_ws = make_mock_ws()
        with patch_connect(mock_ws), \
             patch("finance_agent_sdk.chat_client.asyncio.create_task", return_value=mock_task):
            await client.connect()
        client.disconnect()
        mock_task.cancel.assert_called_once()

    def test_disconnect_when_not_connected_does_not_raise(self, client):
        client.disconnect()  # Should not raise

    async def test_disconnect_makes_is_connected_false(self, client):
        await setup_connected_client(client)
        client.disconnect()
        assert not client.is_connected


# ---------------------------------------------------------------------------
# is_connected
# ---------------------------------------------------------------------------

class TestIsConnected:
    def test_false_when_no_ws(self, client):
        assert not client.is_connected

    async def test_true_when_ws_open(self, client):
        mock_ws = make_mock_ws()
        mock_ws.closed = False
        await setup_connected_client(client, mock_ws)
        assert client.is_connected

    async def test_false_when_ws_closed(self, client):
        mock_ws = make_mock_ws()
        mock_ws.closed = True
        await setup_connected_client(client, mock_ws)
        assert not client.is_connected


# ---------------------------------------------------------------------------
# send actions – error when not connected
# ---------------------------------------------------------------------------

class TestSendWhenNotConnected:
    def test_send_message_raises_runtime_error(self, client):
        with pytest.raises(RuntimeError, match="not connected"):
            client.send_message("Hello")

    def test_get_messages_raises_runtime_error(self, client):
        with pytest.raises(RuntimeError):
            client.get_messages()

    def test_get_typing_status_raises_runtime_error(self, client):
        with pytest.raises(RuntimeError):
            client.get_typing_status()

    def test_start_new_session_raises_runtime_error(self, client):
        with pytest.raises(RuntimeError):
            client.start_new_session()


# ---------------------------------------------------------------------------
# send actions – payload correctness when connected
# ---------------------------------------------------------------------------

class TestSendActions:
    async def _connected(self, client):
        mock_ws = make_mock_ws()
        mock_ws.closed = False
        await setup_connected_client(client, mock_ws)
        return mock_ws

    async def test_send_message_payload(self, client):
        mock_ws = await self._connected(client)
        with patch("finance_agent_sdk.chat_client.asyncio.ensure_future"):
            client.send_message("What is my balance?")
        mock_ws.send.assert_called_once_with(
            json.dumps({"action": "sendMessage", "text": "What is my balance?"})
        )

    async def test_get_messages_payload(self, client):
        mock_ws = await self._connected(client)
        with patch("finance_agent_sdk.chat_client.asyncio.ensure_future"):
            client.get_messages()
        mock_ws.send.assert_called_once_with(json.dumps({"action": "getMessages"}))

    async def test_get_typing_status_payload(self, client):
        mock_ws = await self._connected(client)
        with patch("finance_agent_sdk.chat_client.asyncio.ensure_future"):
            client.get_typing_status()
        mock_ws.send.assert_called_once_with(json.dumps({"action": "getTypingStatus"}))

    async def test_start_new_session_payload(self, client):
        mock_ws = await self._connected(client)
        with patch("finance_agent_sdk.chat_client.asyncio.ensure_future"):
            client.start_new_session()
        mock_ws.send.assert_called_once_with(json.dumps({"action": "startNewSession"}))

    async def test_send_uses_ensure_future(self, client):
        await self._connected(client)
        with patch("finance_agent_sdk.chat_client.asyncio.ensure_future") as mock_ef:
            client.send_message("hi")
        mock_ef.assert_called_once()


# ---------------------------------------------------------------------------
# _dispatch – event routing
# ---------------------------------------------------------------------------

class TestDispatch:
    def test_connected_calls_on_connected_with_session(self, client):
        on_connected = MagicMock()
        client._handlers = ChatEventHandlers(on_connected=on_connected)
        client._dispatch("connected", {"session": {"sessionId": "s1", "createdAt": "2026-01-01"}})

        on_connected.assert_called_once()
        session = on_connected.call_args[0][0]
        assert isinstance(session, Session)
        assert session.sessionId == "s1"
        assert session.createdAt == "2026-01-01"

    def test_connected_no_handler_does_not_raise(self, client):
        client._dispatch("connected", {"session": {"sessionId": "s1", "createdAt": "t"}})

    def test_user_message_calls_handler(self, client):
        on_user_message = MagicMock()
        client._handlers = ChatEventHandlers(on_user_message=on_user_message)
        client._dispatch("userMessage", {"id": "1", "text": "Hello", "sender": "user", "timestamp": "t"})

        on_user_message.assert_called_once()
        msg = on_user_message.call_args[0][0]
        assert isinstance(msg, Message)
        assert msg.text == "Hello"
        assert msg.sender == "user"

    def test_agent_message_calls_handler(self, client):
        on_agent_message = MagicMock()
        client._handlers = ChatEventHandlers(on_agent_message=on_agent_message)
        client._dispatch("agentMessage", {"id": "2", "text": "Response", "sender": "agent", "timestamp": "t"})

        on_agent_message.assert_called_once()
        msg = on_agent_message.call_args[0][0]
        assert msg.sender == "agent"
        assert msg.text == "Response"

    def test_typing_start_calls_handler(self, client):
        on_typing_start = MagicMock()
        client._handlers = ChatEventHandlers(on_typing_start=on_typing_start)
        client._dispatch("typingStart", {})
        on_typing_start.assert_called_once_with()

    def test_typing_stop_calls_handler(self, client):
        on_typing_stop = MagicMock()
        client._handlers = ChatEventHandlers(on_typing_stop=on_typing_stop)
        client._dispatch("typingStop", {})
        on_typing_stop.assert_called_once_with()

    def test_session_reset_calls_handler(self, client):
        on_session_reset = MagicMock()
        client._handlers = ChatEventHandlers(on_session_reset=on_session_reset)
        client._dispatch("sessionReset", {})
        on_session_reset.assert_called_once_with()

    def test_error_calls_handler_with_message(self, client):
        on_error = MagicMock()
        client._handlers = ChatEventHandlers(on_error=on_error)
        client._dispatch("error", {"error": "Something went wrong"})
        on_error.assert_called_once_with("Something went wrong")

    def test_error_uses_unknown_error_fallback(self, client):
        on_error = MagicMock()
        client._handlers = ChatEventHandlers(on_error=on_error)
        client._dispatch("error", {})
        on_error.assert_called_once_with("Unknown error")

    def test_none_data_treated_as_empty_dict(self, client):
        on_typing_stop = MagicMock()
        client._handlers = ChatEventHandlers(on_typing_stop=on_typing_stop)
        client._dispatch("typingStop", None)
        on_typing_stop.assert_called_once_with()

    def test_unknown_event_does_not_raise(self, client):
        client._dispatch("someUnknownEvent", {"foo": "bar"})

    def test_messages_list_event_does_not_raise(self, client):
        client._dispatch("messagesList", {"messages": []})

    def test_new_session_event_does_not_raise(self, client):
        client._dispatch("newSession", {"sessionId": "new-sess"})

    def test_no_handlers_set_no_errors(self, client):
        for event in ("connected", "userMessage", "agentMessage", "typingStart",
                      "typingStop", "sessionReset", "error"):
            client._dispatch(event, {
                "session": {"sessionId": "x", "createdAt": "y"},
                "id": "1", "text": "t", "sender": "user", "timestamp": "t",
            })


# ---------------------------------------------------------------------------
# _listen – background message processing
# ---------------------------------------------------------------------------

class TestListen:
    async def test_listen_dispatches_incoming_messages(self, client):
        on_agent_message = MagicMock()
        client._handlers = ChatEventHandlers(on_agent_message=on_agent_message)

        msg = json.dumps({
            "event": "agentMessage",
            "data": {"id": "1", "text": "Hello!", "sender": "agent", "timestamp": "t"},
        })
        mock_ws = make_mock_ws(messages=[msg])
        client._ws = mock_ws

        await client._listen()

        on_agent_message.assert_called_once()

    async def test_listen_handles_multiple_messages(self, client):
        on_typing_start = MagicMock()
        on_typing_stop = MagicMock()
        client._handlers = ChatEventHandlers(
            on_typing_start=on_typing_start,
            on_typing_stop=on_typing_stop,
        )

        messages = [
            json.dumps({"event": "typingStart", "data": {}}),
            json.dumps({"event": "typingStop", "data": {}}),
        ]
        mock_ws = make_mock_ws(messages=messages)
        client._ws = mock_ws

        await client._listen()

        on_typing_start.assert_called_once()
        on_typing_stop.assert_called_once()

    async def test_listen_ignores_invalid_json(self, client):
        mock_ws = make_mock_ws(messages=["not-json"])
        client._ws = mock_ws
        # Should not raise
        await client._listen()

    async def test_listen_handles_cancellation(self, client):
        async def slow_gen():
            await asyncio.sleep(100)
            yield "message"

        mock_ws = MagicMock()
        mock_ws.__aiter__ = lambda *_: slow_gen()
        client._ws = mock_ws

        task = asyncio.create_task(client._listen())
        await asyncio.sleep(0)  # let task start
        task.cancel()

        # _listen catches CancelledError internally and returns cleanly
        await task  # should complete without raising
        assert task.done()
