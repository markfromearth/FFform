import { PhysicalAddress } from '../types/application';

export interface CompaniesHouseAddress {
  premises?: string;
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}

export interface CompaniesHouseCompany {
  company_name: string;
  company_number: string;
  company_status: string;
  company_type: string;
  date_of_creation: string; // YYYY-MM-DD
  registered_office_address: CompaniesHouseAddress;
  sic_codes?: string[];
  snippet?: string;
}

export interface CompaniesHouseOfficer {
  name: string;
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
  date_of_birth?: {
    month: number;
    year: number;
  };
}

/**
 * Maps Companies House address to structured PhysicalAddress
 */
export function mapCompaniesHouseAddress(raw?: CompaniesHouseAddress): PhysicalAddress {
  if (!raw) {
    return {
      line1: '',
      city: '',
      postcode: '',
      country: 'United Kingdom',
    };
  }

  const line1 = raw.premises && raw.address_line_1
    ? `${raw.premises} ${raw.address_line_1}`.trim()
    : (raw.address_line_1 || raw.premises || '').trim();

  return {
    line1,
    line2: (raw.address_line_2 || '').trim(),
    city: (raw.locality || '').trim(),
    county: (raw.region || '').trim(),
    postcode: (raw.postal_code || '').trim(),
    country: (raw.country || 'United Kingdom').trim(),
  };
}

/**
 * Search Companies House by company name or company registration number.
 * Calls our server-side API endpoint to hide the API key.
 */
export async function searchCompaniesHouse(query: string): Promise<CompaniesHouseCompany[]> {
  const clean = query.trim();
  if (clean.length < 3) return []; // Require at least 3 chars

  try {
    const response = await fetch(`/api/companies-house?endpoint=search/companies&q=${encodeURIComponent(clean)}&items_per_page=8`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.items && Array.isArray(data.items)) {
        return data.items.map((item: any) => ({
          company_name: item.title,
          company_number: item.company_number,
          company_status: item.company_status || 'active',
          company_type: item.company_type || 'ltd',
          date_of_creation: item.date_of_creation || '',
          registered_office_address: item.address || {},
          snippet: item.snippet,
        }));
      }
    }
  } catch (e) {
    console.warn('Companies House search failed:', e);
  }
  return [];
}

// Cache for profile responses
const profileCache = new Map<string, CompaniesHouseCompany | null>();
// Keep track of in-flight requests to prevent duplicates
const inFlightProfileRequests = new Map<string, Promise<CompaniesHouseCompany | null>>();

/**
 * Fetch detailed profile for a specific company registration number
 */
export async function getCompanyProfile(companyNumber: string): Promise<CompaniesHouseCompany | null> {
  const clean = companyNumber.trim().toUpperCase();

  if (profileCache.has(clean)) {
    return profileCache.get(clean) || null;
  }

  if (inFlightProfileRequests.has(clean)) {
    return inFlightProfileRequests.get(clean) || null;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(`/api/companies-house?endpoint=company/${encodeURIComponent(clean)}`);

      if (response.status === 429) {
        console.warn('Companies House API rate limit exceeded (429). Falling back gracefully.');
        profileCache.set(clean, null);
        return null;
      }

      if (response.ok) {
        const data = await response.json();
        const profile = {
          company_name: data.company_name,
          company_number: data.company_number,
          company_status: data.company_status,
          company_type: data.type || data.company_type || 'ltd',
          date_of_creation: data.date_of_creation,
          registered_office_address: data.registered_office_address || {},
          sic_codes: data.sic_codes,
        };
        profileCache.set(clean, profile);
        return profile;
      }
      
      profileCache.set(clean, null);
      return null;
    } catch (e) {
      console.warn('Company profile fetch failed:', e);
      return null;
    } finally {
      inFlightProfileRequests.delete(clean);
    }
  })();

  inFlightProfileRequests.set(clean, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch active officers/directors for a company
 */
export async function getCompanyOfficers(companyNumber: string): Promise<CompaniesHouseOfficer[]> {
  const clean = companyNumber.trim().toUpperCase();

  try {
    const response = await fetch(`/api/companies-house?endpoint=company/${encodeURIComponent(clean)}/officers`);

    if (response.ok) {
      const data = await response.json();
      if (data.items && Array.isArray(data.items)) {
        return data.items.map((item: any) => ({
          name: item.name,
          officer_role: item.officer_role,
          appointed_on: item.appointed_on,
          resigned_on: item.resigned_on,
          date_of_birth: item.date_of_birth,
        }));
      }
    }
  } catch (e) {
    console.warn('Company officers fetch failed:', e);
  }
  return [];
}

export function formatOfficerName(rawName: string): string {
  if (!rawName) return '';
  const clean = rawName.trim();
  if (clean.includes(',')) {
    const parts = clean.split(',').map((p) => p.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const surname = parts[0]
        .toLowerCase()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const forenames = parts[1]
        .toLowerCase()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return `${forenames} ${surname}`;
    }
  }
  // Strip honorifics if present
  const stripped = clean.replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, '').trim();
  if (stripped === stripped.toUpperCase()) {
    return stripped
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return stripped;
}
