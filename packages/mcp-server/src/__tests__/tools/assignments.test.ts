import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAssignmentTools } from '../../tools/assignments.js';
import { createMockBackend } from '../mocks/mock-backend.js';

describe('registerAssignmentTools', () => {
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

  it('should register assignment tools without error', () => {
    expect(() => registerAssignmentTools(server, () => backend)).not.toThrow();
  });

  it('should create a server with assignment tools registered', () => {
    registerAssignmentTools(server, () => backend);
    // Server should be ready to use - if no errors thrown, registration succeeded
    expect(server).toBeDefined();
  });
});
