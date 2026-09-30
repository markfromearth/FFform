export function getStoredPlacesApiKey() {
    return import.meta.env?.VITE_GOOGLE_PLACES_API_KEY || '';
}
/**
 * Enriches company contact details with verified Google Places phone & website,
 * or smart algorithmic area-code & domain prediction.
 */
export async function fetchBusinessEnrichment(companyName, postcode = '', companyNumber = '') {
    if (!companyName && !companyNumber)
        return null;
    try {
        const apiKey = getStoredPlacesApiKey();
        const params = new URLSearchParams();
        if (companyName)
            params.append('name', companyName);
        if (postcode)
            params.append('postcode', postcode);
        if (companyNumber)
            params.append('companyNumber', companyNumber);
        if (apiKey)
            params.append('key', apiKey);
        // Call our serverless proxy
        const response = await fetch(`/api/google-places?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Enrichment failed with status ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.data && (data.data.phone || data.data.website)) {
            const rawPhone = (data.data.phone || '').trim();
            const rawDigits = rawPhone.replace(/\D/g, '');
            const validPhone = rawDigits.length >= 9 ? rawPhone : '';
            const validWebsite = (data.data.website || '').trim();
            if (validPhone || validWebsite) {
                return {
                    phone: validPhone,
                    website: validWebsite,
                    rating: data.data.rating,
                    address: data.data.address,
                    source: data.source || 'Google Places Verified',
                    isDerived: false,
                };
            }
        }
    }
    catch (err) {
        console.warn('Could not enrich from Google Places endpoint:', err);
    }
    // Return null rather than fabricating fake or partial contact info
    return null;
}
