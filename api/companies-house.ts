import crypto from 'crypto';

// In-memory caching for short-term identical requests (lives per-container)
// NOTE: In-memory state is isolated per-instance in Vercel and is not a true global 
// rate limit or cache, but acts as a sufficient safety net per-container.
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Rate Limiting & Backoff State
const requestTimestamps: number[] = [];
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 590; // Safely below 600 limit

let globalBackoffUntil = 0; // Timestamp when we can resume requests

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://factoringfinance.co.uk',
    'https://www.factoringfinance.co.uk',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://factoringfinance.co.uk');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { endpoint, ...queryParams } = req.query || {};
  let targetEndpoint = Array.isArray(endpoint) ? endpoint.join('/') : endpoint || '';
  // Mitigate path traversal
  targetEndpoint = targetEndpoint.replace(/\.\.\//g, '').replace(/\.\//g, '');

  const params = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      params.append(key, String(val));
    }
  });

  const paramString = params.toString();
  const targetUrl = `https://api.company-information.service.gov.uk/${targetEndpoint}${paramString ? '?' + paramString : ''}`;
  const cacheKey = targetUrl;

  try {
    // 1. Check short-term cache
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached.data);
    }

    const envApiKey = process.env.COMPANIES_HOUSE_API_KEY || process.env.VITE_COMPANIES_HOUSE_API_KEY;
    const incomingAuth = req.headers['authorization'];
    const authHeader = incomingAuth || (envApiKey ? `Basic ${Buffer.from(envApiKey + ':').toString('base64')}` : '');

    if (!authHeader) {
      // If no key is provided, we must fallback immediately so the UI doesn't crash
      console.warn('[CompaniesHouseAPI] Integration failure: Missing API key. Falling back to empty/mock to allow manual entry.');
      return serveFallback(targetEndpoint, queryParams, res);
    }

    // 2. Check Backoff State
    if (Date.now() < globalBackoffUntil) {
      console.warn('[CompaniesHouseAPI] Integration failure: Backoff active due to previous 429. Falling back to empty/mock to allow manual entry.');
      res.setHeader('Retry-After', Math.ceil((globalBackoffUntil - Date.now()) / 1000));
      return serveFallback(targetEndpoint, queryParams, res);
    }

    // 3. Sliding Window Rate Limiter
    const now = Date.now();
    // Prune old timestamps
    while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
      requestTimestamps.shift();
    }
    
    if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      console.warn('[CompaniesHouseAPI] Integration failure: Internal rate limit reached. Falling back to empty/mock.');
      // Enforce a brief backoff
      globalBackoffUntil = now + 30000; 
      return serveFallback(targetEndpoint, queryParams, res);
    }

    // Record request attempt
    requestTimestamps.push(now);

    // 4. Fetch from CH API
    const response = await fetch(targetUrl, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000)
    });

    if (response.status === 429) {
      console.warn('[CompaniesHouseAPI] Integration failure: Received 429 Too Many Requests from CH. Enabling backoff.');
      globalBackoffUntil = Date.now() + 60000; // 60 second backoff
      return serveFallback(targetEndpoint, queryParams, res);
    }

    if (!response.ok) {
      console.warn(`[CompaniesHouseAPI] Integration failure: CH API returned ${response.status} for URL: ${targetUrl}`);
      return serveFallback(targetEndpoint, queryParams, res);
    }

    const data = await response.json();

    // 5. Cache successful result
    cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL });
    
    // Prune cache if it gets too large
    if (cache.size > 1000) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(data);

  } catch (error: any) {
    console.error(`[CompaniesHouseAPI] Integration failure for URL: ${targetUrl}. Error:`, error?.message || 'Unknown error');
    // On unexpected failure, ensure form remains usable via fallback
    return serveFallback(targetEndpoint, queryParams, res);
  }
}

// Fallback logic returns empty structures matching CH schema, ensuring the frontend gracefully drops to manual entry
function serveFallback(targetEndpoint: string, queryParams: any, res: any) {
  res.setHeader('X-Fallback', 'true');
  
  if (targetEndpoint.includes('search/companies')) {
    // Return empty items so frontend displays "No results found. Enter manually."
    return res.status(200).json({ items: [] });
  }

  if (targetEndpoint.includes('/officers')) {
    return res.status(200).json({ items: [] });
  }

  if (targetEndpoint.includes('persons-with-significant-control')) {
    return res.status(200).json({ items: [] });
  }

  if (targetEndpoint.startsWith('company/')) {
    // Simulating a not found response triggers manual flow
    return res.status(404).json({ error: 'Company not found (fallback active)' });
  }

  return res.status(200).json({});
}
