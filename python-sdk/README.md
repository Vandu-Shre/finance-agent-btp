# Finance Agent Python SDK

Python SDK for interacting with the Finance Agent API.

## Installation

```bash
pip install vs-finance-agent-sdk
```

## Usage

### Initialize the SDK

```python
from finance_agent_sdk import FinanceAgentSDK, FinanceAgentConfig

client = FinanceAgentSDK(FinanceAgentConfig(
    base_url="https://your-app.cfapps.eu10.hana.ondemand.com",
))
```

### File Operations

#### Upload a File

```python
import asyncio

async def main():
    # From a file path
    result = await client.files.upload_file("document.pdf")
    print("Uploaded:", result.file)

    # From raw bytes
    with open("document.pdf", "rb") as f:
        content = f.read()
    result = await client.files.upload_file(content, filename="document.pdf")

asyncio.run(main())
```

#### List All Files

```python
files = await client.files.get_files()
print("Files:", files)
```

#### Delete a File

```python
message = await client.files.delete_file("stored-filename.pdf")
print(message)  # "File deleted successfully"
```

### Chat Operations

#### Connect to Chat

```python
from finance_agent_sdk.types import ChatEventHandlers

await client.chat.connect(ChatEventHandlers(
    on_connected=lambda session: print("Connected to session:", session.sessionId),
    on_agent_message=lambda message: print("Agent says:", message.text),
    on_user_message=lambda message: print("User says:", message.text),
    on_typing_start=lambda: print("Agent is typing..."),
    on_typing_stop=lambda: print("Agent stopped typing"),
    on_error=lambda error: print("Chat error:", error),
))
```

#### Send a Message

```python
client.chat.send_message("Hello, how can you help me?")
```

#### Get All Messages

```python
client.chat.get_messages()
```

#### Start New Session

```python
client.chat.start_new_session()
```

#### Disconnect

```python
client.chat.disconnect()
```

### Complete Example

```python
import asyncio
from finance_agent_sdk import FinanceAgentSDK, FinanceAgentConfig
from finance_agent_sdk.types import ChatEventHandlers

async def main():
    # Initialize SDK
    client = FinanceAgentSDK(FinanceAgentConfig(
        base_url="https://your-app.cfapps.eu10.hana.ondemand.com",
    ))

    # Connect to chat
    await client.chat.connect(ChatEventHandlers(
        on_agent_message=lambda message: print("Agent:", message.text),
    ))

    # Send a message
    client.chat.send_message("What files do I have?")

    # List files
    files = await client.files.get_files()
    print("Available files:", len(files))

    # Disconnect when done
    await asyncio.sleep(30)
    client.chat.disconnect()

asyncio.run(main())
```

## API Reference

### `FinanceAgentSDK`

Main SDK class that provides access to file and chat clients.

#### Constructor

```python
FinanceAgentSDK(config: FinanceAgentConfig)
```

**Config options:**

- `base_url` (required): Base URL of the Finance Agent API
- `auth_token` (optional): Sent as `Authorization: Bearer <token>`
- `headers` (optional): Custom headers merged into every request

### `FileClient`

Handles file operations over HTTP. Accessed via `sdk.files`.

#### Methods

- `upload_file(source, *, filename=None)`: Upload a file. `source` can be a path (`str`/`Path`) or raw `bytes` (requires `filename`)
- `get_files()`: Get list of all uploaded files
- `delete_file(filename)`: Delete a file by its stored name

### `ChatClient`

Handles WebSocket-based chat communication. Accessed via `sdk.chat`.

#### Methods

- `connect(handlers)`: Connect to the chat WebSocket and start listening
- `send_message(text)`: Send a chat message
- `get_messages()`: Request all messages from the server
- `get_typing_status()`: Get the current typing status
- `start_new_session()`: Start a new chat session
- `disconnect()`: Disconnect from the WebSocket
- `is_connected`: Property — `True` when the connection is open

## Types

```python
from dataclasses import dataclass
from typing import Literal

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

@dataclass
class FileInfo:
    fileName: str
    storedName: str
    type: str
    size: str
    uploadDate: str
    path: str | None = None
```

See [`finance_agent_sdk/types.py`](./finance_agent_sdk/types.py) for all type definitions.

## Requirements

- Python 3.11+
- `httpx >= 0.27`
- `websockets >= 13.0`

## Roadmap

### Authentication (Coming Soon)

Future versions will include built-in support for SAP Identity and Access Management (IAS) and XSUAA authentication flows:

- **Client Credentials Flow** — for server-to-server integrations where the application authenticates directly using a client ID and secret, without user involvement.
- **Authorization Code Flow** — for user-facing applications where end users authenticate via IAS/XSUAA and the SDK exchanges the authorization code for an access token automatically.

These additions will make it straightforward to integrate the SDK securely into SAP BTP environments without manually managing tokens.

## License

MIT
