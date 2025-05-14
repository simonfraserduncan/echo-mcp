import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';

// Set up the port to listen on (default 8000 or from env variable)
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000;

// Create an MCP server
const createMcpServer = () => {
  const server = new McpServer({
    name: 'echo-mcp-server',
    version: '0.0.1',
  }, { capabilities: { tools: {} } });

  // Echo tool
  server.tool('echo', 'Echoes back the message provided', {
    message: {
      type: 'string',
      description: 'The message to echo back',
    },
  }, async ({ message }) => {
    console.log(`Echo tool called with message: ${message}`);
    // Return value in the correct MCP response format
    return {
      value: message
    };
  });

  // Ping tool
  server.tool('ping', 'Returns "pong" when called', {}, async () => {
    console.log('Ping tool called');
    // Return value in the correct MCP response format
    return {
      value: "pong"
    };
  });

  // Version tool
  server.tool('version', 'Returns the server version', {}, async () => {
    console.log('Version tool called');
    // Return value in the correct MCP response format
    return {
      value: "0.0.1"
    };
  });

  return server;
};

// Create Express app
const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

// Handle POST requests for JSON-RPC
app.post('/mcp', async (req, res) => {
  try {
    console.log('Received POST request to /mcp');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(req.body));
    
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string;
    let transport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      console.log(`Reusing existing transport for session ${sessionId}`);
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      console.log('Processing new initialization request');
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        }
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server
      console.log('Creating and connecting MCP server to transport');
      const server = createMcpServer();
      await server.connect(transport);
      console.log('Server connected to transport');
    } else {
      // Invalid request - no session ID or not initialization request
      console.log('Invalid request - no session ID or not initialization request');
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with transport
    console.log('Handling request with transport');
    try {
      await transport.handleRequest(req, res, req.body);
      console.log('Request handling completed successfully');
    } catch (err) {
      console.error('Error in transport.handleRequest:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Transport error handling request',
          },
          id: req.body.id || null,
        });
      }
    }
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Handle GET requests for SSE streams
app.get('/mcp', async (req, res) => {
  try {
    console.log('Received GET request to /mcp');
    console.log('Headers:', JSON.stringify(req.headers));
    
    const sessionId = req.headers['mcp-session-id'] as string;
    if (!sessionId || !transports[sessionId]) {
      console.log(`Invalid or missing session ID: ${sessionId}`);
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    console.log(`Handling GET request for session ${sessionId}`);
    const transport = transports[sessionId];
    try {
      await transport.handleRequest(req, res);
      console.log('GET request handling completed successfully');
    } catch (err) {
      console.error('Error in transport.handleRequest for GET:', err);
      if (!res.headersSent) {
        res.status(500).send('Error processing SSE request');
      }
    }
  } catch (error) {
    console.error('Error handling GET request:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing request');
    }
  }
});

// Handle DELETE requests for session termination
app.delete('/mcp', async (req, res) => {
  try {
    console.log('Received DELETE request to /mcp');
    console.log('Headers:', JSON.stringify(req.headers));
    
    const sessionId = req.headers['mcp-session-id'] as string;
    if (!sessionId || !transports[sessionId]) {
      console.log(`Invalid or missing session ID: ${sessionId}`);
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    console.log(`Processing session termination for ${sessionId}`);
    const transport = transports[sessionId];
    try {
      await transport.handleRequest(req, res);
      console.log('Session termination completed successfully');
    } catch (err) {
      console.error('Error in transport.handleRequest for DELETE:', err);
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination');
      }
    }
  } catch (error) {
    console.error('Error handling session termination:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`MCP server listening on ${PORT}`);
});

// Set higher timeout (5 minutes)
server.timeout = 300000;

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  
  // Close all active transports
  for (const sessionId in transports) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }

  process.exit(0);
}); 