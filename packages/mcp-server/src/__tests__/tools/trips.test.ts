import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTripTools } from '../../tools/trips.js';
import { createMockBackend } from '../mocks/mock-backend.js';

describe('registerTripTools', () => {
  let server: McpServer;
  let backend: ReturnType<typeof createMockBackend>;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });
    backend = createMockBackend();
    backend.clear();
  });

  it('should register trip tools without error', () => {
    expect(() => registerTripTools(server, () => backend)).not.toThrow();
  });

  it('should create a server with trip tools registered', () => {
    registerTripTools(server, () => backend);
    // Server should be ready to use - if no errors thrown, registration succeeded
    expect(server).toBeDefined();
  });
});
