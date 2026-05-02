import { vi } from 'vitest';

// Global test setup can go here

// Mock console methods to reduce noise during tests
// but still allow errors to show
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
