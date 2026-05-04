import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPoiTools } from '../../tools/pois.js';
import { createMockBackend } from '../mocks/mock-backend.js';

describe('registerPoiTools', () => {
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

  it('should register POI tools without error', () => {
    expect(() => registerPoiTools(server, () => backend)).not.toThrow();
  });

  it('should create a server with POI tools registered', () => {
    registerPoiTools(server, () => backend);
    // Server should be ready to use - if no errors thrown, registration succeeded
    expect(server).toBeDefined();
  });
});
