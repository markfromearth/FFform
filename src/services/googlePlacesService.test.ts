import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchBusinessEnrichment,
  getStoredPlacesApiKey,
} from './googlePlacesService';

describe('Google Places Service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('fetchBusinessEnrichment', () => {
    it('returns null if no company name or company number is provided', async () => {
      const result = await fetchBusinessEnrichment('', '');
      expect(result).toBeNull();
    });

    it('returns verified places data for Apex Hospitality via mock/serverless response', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes('SC589210') || urlStr.includes('APEX')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              source: 'Google Places Verified',
              data: {
                phone: '0141 248 9900',
                website: 'www.apexhospitality.co.uk',
                rating: 4.8,
              },
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const result = await fetchBusinessEnrichment('APEX HOSPITALITY GROUP LTD', 'G2 4JP', 'SC589210');
      expect(result).not.toBeNull();
      expect(result?.phone).toBe('0141 248 9900');
      expect(result?.website).toBe('www.apexhospitality.co.uk');
      expect(result?.source).toBe('Google Places Verified');
    });

    it('returns null when endpoint is unavailable rather than fabricating false contact details', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await fetchBusinessEnrichment('Acme Consulting Ltd', 'EC2A 1NT');
      expect(result).toBeNull();
    });

    it('returns null when endpoint returns success: false or empty contact data', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          data: null,
        }),
      } as Response);

      const result = await fetchBusinessEnrichment('Unknown Trading Ltd', 'SW1A 1AA');
      expect(result).toBeNull();
    });
  });
});
