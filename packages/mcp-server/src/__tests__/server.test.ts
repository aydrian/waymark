import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from '../server.js';
import { registerTripTools } from '../tools/trips.js';
import { registerPoiTools } from '../tools/pois.js';
import { registerAssignmentTools } from '../tools/assignments.js';

describe('Server exports', () => {
  it('should export registerTripTools function', () => {
    expect(registerTripTools).toBeDefined();
    expect(typeof registerTripTools).toBe('function');
  });

  it('should export registerPoiTools function', () => {
    expect(registerPoiTools).toBeDefined();
    expect(typeof registerPoiTools).toBe('function');
  });

  it('should export registerAssignmentTools function', () => {
    expect(registerAssignmentTools).toBeDefined();
    expect(typeof registerAssignmentTools).toBe('function');
  });

  it('should export createServer function', () => {
    expect(createServer).toBeDefined();
    expect(typeof createServer).toBe('function');
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

  it('should create server that can be used', () => {
    const server = createServer();
    // The server should have methods like registerTool(), connect(), etc.
    expect(typeof server.registerTool).toBe('function');
    expect(typeof server.connect).toBe('function');
    expect(typeof server.close).toBe('function');
  });
});

describe('Environment handling', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create server even without WAYMARK_ADMIN_TOKEN', () => {
    // Token check now happens at tool execution time, not server creation
    process.env = { ...originalEnv, WAYMARK_ADMIN_TOKEN: '' };

    const server = createServer();
    expect(server).toBeDefined();
  });
});
