export const SIC_MAPPINGS = {
  construction: ['41', '42', '43'],
  recruitment: ['7810', '7820', '7830'],
  haulage: ['4941', '4942', '5210', '5221', '5229'],
};

/**
 * Maps a list of Companies House SIC codes to our internal industry sector values.
 * Evaluates SIC codes in order and returns the first match.
 *
 * @param sicCodes - Array of SIC codes as strings
 * @returns The matching industry sector value, or 'other' if no match.
 */
export function mapSicToSector(sicCodes?: string[]): string {
  if (!sicCodes || !Array.isArray(sicCodes) || sicCodes.length === 0) {
    return 'other';
  }

  for (const code of sicCodes) {
    const cleanCode = code.trim();

    // Check Construction
    if (SIC_MAPPINGS.construction.some(prefix => cleanCode.startsWith(prefix))) {
      return 'construction';
    }

    // Check Recruitment
    if (SIC_MAPPINGS.recruitment.some(prefix => cleanCode.startsWith(prefix))) {
      return 'recruitment';
    }

    // Check Haulage
    if (SIC_MAPPINGS.haulage.some(prefix => cleanCode.startsWith(prefix))) {
      return 'haulage';
    }

    // Check Manufacturing (10 through 33)
    const firstTwo = parseInt(cleanCode.substring(0, 2), 10);
    if (!isNaN(firstTwo) && firstTwo >= 10 && firstTwo <= 33) {
      return 'manufacturing';
    }
  }

  return 'other';
}
