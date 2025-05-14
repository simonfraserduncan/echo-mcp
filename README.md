# Echo MCP Server

A minimal MCP (Model Context Protocol) server implementation for Smithery.

## Features

- **Echo Tool**: Returns the message provided
- **Ping Tool**: Returns "pong" when called
- **Version Tool**: Returns the server version "0.0.1"
- Implements the [MCP Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)
- No external APIs, auth, or database dependencies

## Installation

```bash
npm install
```

## Running the Server

Start the server on port 8000:

```bash
npm start
```

The server will be available at `http://localhost:8000/mcp`.

## Testing

### Using MCP Inspector

1. Install MCP Inspector:
   ```bash
   npm install -g @modelcontextprotocol/inspector
   ```

2. Start the MCP Inspector:
   ```bash
   npx @modelcontextprotocol/inspector streamable-http http://localhost:8000/mcp
   ```

3. Open the Inspector UI at http://127.0.0.1:6274
   - Set Transport Type to "Streamable HTTP"
   - Set URL to "http://localhost:8000/mcp"
   - Click Connect

### Using cURL

Initialize a session:

```bash
curl -v -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl-client","version":"1.0.0"}},"id":1}' \
     http://localhost:8000/mcp
```

Send "initialized" notification (using the session ID from the response headers):

```bash
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: YOUR_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"initialized","params":{}}' \
     http://localhost:8000/mcp
```

List available tools:

```bash
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: YOUR_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}' \
     http://localhost:8000/mcp
```

Call the echo tool:

```bash
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: YOUR_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","input":{"message":"hello"}},"id":3}' \
     http://localhost:8000/mcp
```

## License

ISC 