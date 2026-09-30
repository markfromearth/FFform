import { describe, it, expect } from 'vitest';
import { mapSicToSector } from './sicMapping';

describe('mapSicToSector', () => {
  it('maps single matching codes for each sector', () => {
    // Construction: 41, 42, 43
    expect(mapSicToSector(['41202'])).toBe('construction');
    expect(mapSicToSector(['42110'])).toBe('construction');
    expect(mapSicToSector(['43210'])).toBe('construction');

    // Recruitment: 7810, 7820, 7830
    expect(mapSicToSector(['78109'])).toBe('recruitment');
    expect(mapSicToSector(['78200'])).toBe('recruitment');

    // Haulage: 4941, 4942, 5210, 5221, 5229
    expect(mapSicToSector(['49410'])).toBe('haulage');
    expect(mapSicToSector(['52290'])).toBe('haulage');

    // Manufacturing: 10 through 33
    expect(mapSicToSector(['15110'])).toBe('manufacturing');
    expect(mapSicToSector(['25110'])).toBe('manufacturing');
  });

  it('maps multiple codes where the first matches', () => {
    // Construction first, then Other
    expect(mapSicToSector(['41202', '99999'])).toBe('construction');
  });

  it('maps multiple codes where a later one matches', () => {
    // Other first, then Recruitment
    expect(mapSicToSector(['99999', '78109'])).toBe('recruitment');
  });

  it('handles boundary codes for Manufacturing', () => {
    // 10xxx is Manufacturing
    expect(mapSicToSector(['10110'])).toBe('manufacturing');
    // 33xxx is Manufacturing
    expect(mapSicToSector(['33120'])).toBe('manufacturing');
    
    // 09xxx is Other
    expect(mapSicToSector(['09100'])).toBe('other');
    // 34xxx is Other (Note: SIC 2007 maxes around 99, but let's test the prefix logic)
    expect(mapSicToSector(['34110'])).toBe('other');
  });

  it('returns "other" for empty array, undefined, and non-trading codes', () => {
    expect(mapSicToSector([])).toBe('other');
    expect(mapSicToSector(undefined)).toBe('other');
    
    // Non-trading codes
    expect(mapSicToSector(['99999'])).toBe('other');
    expect(mapSicToSector(['74990'])).toBe('other');
    
    // Some random unrelated codes
    expect(mapSicToSector(['62020'])).toBe('other'); // IT consulting
    expect(mapSicToSector(['56101'])).toBe('other'); // Restaurants
  });
});
