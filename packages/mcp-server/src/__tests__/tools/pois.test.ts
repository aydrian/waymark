import { describe, it, expect, beforeEach } from 'vitest';
import { handlePoiTool, poiTools } from '../../tools/pois.js';
import { createMockBackend } from '../mocks/mock-backend.js';
import type { GlobalPOI } from '@itsaydrian/waymark-shared/types';

describe('poiTools', () => {
  it('should export 6 POI tools', () => {
    expect(poiTools).toHaveLength(6);
    expect(poiTools.map(t => t.name)).toContain('list_pois');
    expect(poiTools.map(t => t.name)).toContain('get_poi');
    expect(poiTools.map(t => t.name)).toContain('create_poi');
    expect(poiTools.map(t => t.name)).toContain('update_poi');
    expect(poiTools.map(t => t.name)).toContain('delete_poi');
    expect(poiTools.map(t => t.name)).toContain('search_pois');
  });
});

describe('handlePoiTool', () => {
  let backend: ReturnType<typeof createMockBackend>;

  const samplePOI: GlobalPOI = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Restaurant',
    category: 'restaurant',
    city: 'Paris',
    address: '123 Test St',
    lat: 48.8566,
    lng: 2.3522,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    backend = createMockBackend();
    backend.clear();
  });

  describe('list_pois', () => {
    it('should return empty array when no POIs exist', async () => {
      const result = await handlePoiTool('list_pois', {}, backend);

      expect(result?.content[0].text).toBe('[]');
    });

    it('should return all POIs sorted by name', async () => {
      backend.seedPOIs([samplePOI]);
      const result = await handlePoiTool('list_pois', {}, backend);

      expect(result?.content[0].text).toContain('Test Restaurant');
    });

    it('should call backend.listGlobalPOIs', async () => {
      await handlePoiTool('list_pois', {}, backend);
      expect(backend.calls).toContainEqual({ method: 'listGlobalPOIs', args: [] });
    });
  });

  describe('get_poi', () => {
    it('should return POI when found', async () => {
      backend.seedPOIs([samplePOI]);
      const result = await handlePoiTool('get_poi', { id: samplePOI.id }, backend);

      expect(result?.content[0].text).toContain('Test Restaurant');
      expect(result?.content[0].text).toContain('Paris');
    });

    it('should return error for non-existent POI', async () => {
      const result = await handlePoiTool('get_poi', { id: '550e8400-e29b-41d4-a716-446655440001' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('POI not found');
    });

    it('should return validation error for invalid UUID', async () => {
      const result = await handlePoiTool('get_poi', { id: 'not-a-uuid' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });
  });

  describe('create_poi', () => {
    const validPOIInput = {
      name: 'New Restaurant',
      category: 'restaurant',
      city: 'Rome',
      address: '456 Via Test',
      lat: 41.9028,
      lng: 12.4964,
    };

    it('should create POI with valid input', async () => {
      const result = await handlePoiTool('create_poi', validPOIInput, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"name": "New Restaurant"');
      expect(result?.content[0].text).toContain('"id":');
    });

    it('should call backend.createGlobalPOI', async () => {
      await handlePoiTool('create_poi', validPOIInput, backend);

      expect(backend.calls).toContainEqual({
        method: 'createGlobalPOI',
        args: [expect.objectContaining({ name: 'New Restaurant', city: 'Rome' })],
      });
    });

    it('should return validation error for missing required fields', async () => {
      const result = await handlePoiTool('create_poi', { name: 'Incomplete' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });

    it('should return validation error for invalid category', async () => {
      const result = await handlePoiTool('create_poi', {
        ...validPOIInput,
        category: 'invalid_category',
      }, backend);

      expect(result?.isError).toBe(true);
    });
  });

  describe('update_poi', () => {
    it('should update existing POI', async () => {
      backend.seedPOIs([samplePOI]);
      const result = await handlePoiTool('update_poi', {
        id: samplePOI.id,
        name: 'Updated Name',
      }, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"name": "Updated Name"');
    });

    it('should return error for non-existent POI', async () => {
      const result = await handlePoiTool('update_poi', {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'New Name',
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('POI not found');
    });

    it('should return validation error for invalid UUID', async () => {
      const result = await handlePoiTool('update_poi', { id: 'invalid', name: 'Test' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });

    it('should call backend.putGlobalPOI with merged data', async () => {
      backend.seedPOIs([samplePOI]);
      await handlePoiTool('update_poi', { id: samplePOI.id, name: 'New Name' }, backend);

      expect(backend.calls).toContainEqual({
        method: 'putGlobalPOI',
        args: [expect.objectContaining({ id: samplePOI.id, name: 'New Name', city: 'Paris' })],
      });
    });
  });

  describe('delete_poi', () => {
    it('should delete existing POI', async () => {
      backend.seedPOIs([samplePOI]);
      const result = await handlePoiTool('delete_poi', { id: samplePOI.id }, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"success": true');
      expect(result?.content[0].text).toContain('"deleted": true');
    });

    it('should return error for non-existent POI', async () => {
      const result = await handlePoiTool('delete_poi', { id: '550e8400-e29b-41d4-a716-446655440001' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('POI not found');
    });

    it('should return validation error for invalid UUID', async () => {
      const result = await handlePoiTool('delete_poi', { id: 'invalid' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });

    it('should call backend.deleteGlobalPOI', async () => {
      await handlePoiTool('delete_poi', { id: samplePOI.id }, backend);

      expect(backend.calls).toContainEqual({ method: 'deleteGlobalPOI', args: [samplePOI.id] });
    });
  });

  describe('search_pois', () => {
    beforeEach(() => {
      backend.seedPOIs([
        samplePOI,
        { ...samplePOI, id: '550e8400-e29b-41d4-a716-446655440001', name: 'Paris Shop', category: 'shop', city: 'Paris' },
        { ...samplePOI, id: '550e8400-e29b-41d4-a716-446655440002', name: 'Rome Restaurant', category: 'restaurant', city: 'Rome' },
      ]);
    });

    it('should return all POIs when no filters provided', async () => {
      const result = await handlePoiTool('search_pois', {}, backend);

      expect(result?.content[0].text).toContain('"count": 3');
    });

    it('should filter by city', async () => {
      const result = await handlePoiTool('search_pois', { city: 'Paris' }, backend);

      expect(result?.content[0].text).toContain('"count": 2');
      expect(result?.content[0].text).toContain('Test Restaurant');
      expect(result?.content[0].text).toContain('Paris Shop');
    });

    it('should filter by category', async () => {
      const result = await handlePoiTool('search_pois', { category: 'shop' }, backend);

      expect(result?.content[0].text).toContain('"count": 1');
      expect(result?.content[0].text).toContain('Paris Shop');
    });

    it('should filter by name substring', async () => {
      const result = await handlePoiTool('search_pois', { name: 'Rome' }, backend);

      expect(result?.content[0].text).toContain('"count": 1');
      expect(result?.content[0].text).toContain('Rome Restaurant');
    });

    it('should combine multiple filters', async () => {
      const result = await handlePoiTool('search_pois', { city: 'Paris', category: 'restaurant' }, backend);

      expect(result?.content[0].text).toContain('"count": 1');
      expect(result?.content[0].text).toContain('Test Restaurant');
    });

    it('should return empty results when no matches', async () => {
      const result = await handlePoiTool('search_pois', { city: 'Tokyo' }, backend);

      expect(result?.content[0].text).toContain('"count": 0');
    });

    it('should return validation error for invalid category', async () => {
      const result = await handlePoiTool('search_pois', { category: 'invalid' as any }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });
  });

  describe('unknown tool', () => {
    it('should return undefined for unknown tool name', async () => {
      const result = await handlePoiTool('unknown_tool', {}, backend);
      expect(result).toBeUndefined();
    });
  });
});
