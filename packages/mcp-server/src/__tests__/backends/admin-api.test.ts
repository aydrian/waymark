import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminApiBackend } from '../../backends/admin-api.js';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function mockResponse(response: Partial<Response>) {
  return response as unknown as Response;
}

describe('createAdminApiBackend', () => {
  const baseUrl = 'https://test.waymark.com';
  const authToken = 'test-token-123';

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('fetch wrapper', () => {
    it('should include authorization header with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        json: async () => ({ trips: [] }),
      }));

      const backend = createAdminApiBackend({ baseUrl, authToken });
      await backend.listTrips();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.waymark.com/api/admin/trips',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should remove trailing slash from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        json: async () => ({ trips: [] }),
      }));

      const backend = createAdminApiBackend({ baseUrl: 'https://test.waymark.com/', authToken });
      await backend.listTrips();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.waymark.com/api/admin/trips',
        expect.any(Object)
      );
    });

    it('should throw on API error with status and message', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }));

      const backend = createAdminApiBackend({ baseUrl, authToken });
      await expect(backend.listTrips()).rejects.toThrow('API error 500: Internal Server Error');
    });

    it('should return undefined for 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 204,
      }));

      const backend = createAdminApiBackend({ baseUrl, authToken });
      const result = await backend.putTrip({} as any);
      expect(result).toBeUndefined();
    });
  });

  describe('trip operations', () => {
    describe('listTrips', () => {
      it('should return empty array when no trips exist', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 200,
          json: async () => ({ trips: [] }),
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const trips = await backend.listTrips();
        expect(trips).toEqual([]);
      });

      it('should return trips from response', async () => {
        const mockTrips = [
          { id: 'abc12345', title: 'Trip 1', startDate: '2024-01-01', endDate: '2024-01-07', destinations: ['Paris'], timezone: 'Europe/Paris', updatedAt: '2024-01-01T00:00:00Z' },
        ];
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 200,
          json: async () => ({ trips: mockTrips }),
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const trips = await backend.listTrips();
        expect(trips).toEqual(mockTrips);
      });
    });

    describe('getTrip', () => {
      it('should return trip when found', async () => {
        const mockTrip = { id: 'abc12345', title: 'Test Trip' };
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 200,
          json: async () => mockTrip,
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const trip = await backend.getTrip('abc12345');
        expect(trip).toEqual(mockTrip);
      });

      it('should return null on 404', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const trip = await backend.getTrip('nonexistent');
        expect(trip).toBeNull();
      });

      it('should throw on other errors', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: false,
          status: 500,
          text: async () => 'Server Error',
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        await expect(backend.getTrip('abc12345')).rejects.toThrow();
      });
    });

    describe('putTrip', () => {
      it('should POST to /trips/upsert', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 204,
        }));

        const trip = { id: 'abc12345', title: 'Test' } as any;
        const backend = createAdminApiBackend({ baseUrl, authToken });
        await backend.putTrip(trip);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/trips/upsert'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(trip),
          })
        );
      });
    });

    describe('deleteTrip', () => {
      it('should POST to /trips/delete with id', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 204,
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        await backend.deleteTrip('abc12345');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/trips/delete'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ id: 'abc12345' }),
          })
        );
      });

      it('should return false on 404', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const result = await backend.deleteTrip('nonexistent');
        expect(result).toBe(false);
      });

      it('should return true on success', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 204,
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const result = await backend.deleteTrip('abc12345');
        expect(result).toBe(true);
      });
    });
  });

  describe('POI operations', () => {
    describe('listGlobalPOIs', () => {
      it('should return POIs from /pois endpoint', async () => {
        const mockPOIs = [{ id: 'poi-1', name: 'Test POI' }];
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 200,
          json: async () => mockPOIs,
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const pois = await backend.listGlobalPOIs();
        expect(pois).toEqual(mockPOIs);
      });

      it('should throw on non-404 errors', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: false,
          status: 500,
          text: async () => 'Server Error',
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        await expect(backend.listGlobalPOIs()).rejects.toThrow('API error 500');
      });
    });

    describe('getGlobalPOI', () => {
      it('should return null on 404', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const poi = await backend.getGlobalPOI('nonexistent');
        expect(poi).toBeNull();
      });
    });

    describe('createGlobalPOI', () => {
      it('should POST to /pois', async () => {
        const mockPOI = { id: 'new-poi', name: 'New POI' };
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 201,
          json: async () => mockPOI,
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        await backend.createGlobalPOI({ name: 'New POI', category: 'restaurant', city: 'Paris' });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/pois'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('should throw on error response', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: false,
          status: 400,
          text: async () => 'Bad Request',
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        await expect(backend.createGlobalPOI({ name: 'New POI', category: 'restaurant', city: 'Paris' }))
          .rejects.toThrow('API error 400');
      });
    });

    describe('putGlobalPOI', () => {
      it('should PUT to /pois/:id when id exists', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 204,
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        await backend.putGlobalPOI({ id: 'poi-1', name: 'Updated', category: 'restaurant', city: 'Paris' } as any);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/pois/poi-1'),
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });

      it('should POST to /pois when id is missing', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 201,
          json: async () => ({ id: 'new-poi' }),
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        await backend.putGlobalPOI({ name: 'New', category: 'restaurant', city: 'Paris' } as any);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/pois'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    describe('deleteGlobalPOI', () => {
      it('should DELETE to /pois/:id', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: true,
          status: 204,
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        await backend.deleteGlobalPOI('poi-1');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/pois/poi-1'),
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      it('should return false on 404', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        }));

        const backend = createAdminApiBackend({ baseUrl, authToken });
        const result = await backend.deleteGlobalPOI('nonexistent');
        expect(result).toBe(false);
      });
    });
  });
});
