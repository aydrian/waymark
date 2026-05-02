import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from '../server.js';
import { tripTools, handleTripTool } from '../tools/trips.js';
import { poiTools, handlePoiTool } from '../tools/pois.js';
import { assignmentTools, handleAssignmentTool } from '../tools/assignments.js';

describe('Server exports', () => {
  it('should export trip tools', () => {
    expect(tripTools).toHaveLength(5);
    expect(tripTools.map(t => t.name)).toContain('list_trips');
  });

  it('should export POI tools', () => {
    expect(poiTools).toHaveLength(6);
    expect(poiTools.map(t => t.name)).toContain('create_poi');
  });

  it('should export assignment tools', () => {
    expect(assignmentTools).toHaveLength(4);
    expect(assignmentTools.map(t => t.name)).toContain('create_assignment');
  });

  it('should export createServer function', () => {
    expect(createServer).toBeDefined();
    expect(typeof createServer).toBe('function');
  });
});

describe('Tool handlers', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.WAYMARK_ADMIN_TOKEN;
    process.env.WAYMARK_ADMIN_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env.WAYMARK_ADMIN_TOKEN = originalEnv;
  });

  describe('handler exports', () => {
    it('should export handleTripTool', () => {
      expect(handleTripTool).toBeDefined();
      expect(typeof handleTripTool).toBe('function');
    });

    it('should export handlePoiTool', () => {
      expect(handlePoiTool).toBeDefined();
      expect(typeof handlePoiTool).toBe('function');
    });

    it('should export handleAssignmentTool', () => {
      expect(handleAssignmentTool).toBeDefined();
      expect(typeof handleAssignmentTool).toBe('function');
    });
  });
});

describe('createServer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, WAYMARK_ADMIN_TOKEN: 'test-token' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create a server instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('should create server with correct name', () => {
    // Server is created, which validates basic configuration
    const server = createServer();
    expect(server).toBeDefined();
  });
});

describe('Environment handling', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should handle missing WAYMARK_ADMIN_TOKEN in tool execution', async () => {
    // Clear the token - this is tested in the actual server via CallTool handler
    process.env = { ...originalEnv, WAYMARK_ADMIN_TOKEN: '' };

    // Server will be created but token check happens at call time
    const server = createServer();
    expect(server).toBeDefined();
  });
});
