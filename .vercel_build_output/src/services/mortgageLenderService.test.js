import { describe, it, expect } from 'vitest';
import { searchCuratedLenders, searchMortgageLenders, UK_AUTHORIZED_MORTGAGE_LENDERS, } from './mortgageLenderService';
describe('Mortgage Lender Service (FCA & UK Finance Register)', () => {
    it('has comprehensive list of UK authorized mortgage lenders', () => {
        expect(UK_AUTHORIZED_MORTGAGE_LENDERS.length).toBeGreaterThan(40);
        // Verify all lenders have official names, phone numbers, and categories
        for (const lender of UK_AUTHORIZED_MORTGAGE_LENDERS) {
            expect(lender.name).toBeTruthy();
            expect(lender.phone).toBeTruthy();
            expect(lender.category).toBeTruthy();
        }
    });
    it('matches high street banks by exact or partial query', () => {
        const barclays = searchCuratedLenders('barclays');
        expect(barclays.length).toBeGreaterThan(0);
        expect(barclays[0].name).toContain('Barclays');
        expect(barclays[0].phone).toBe('0800 028 1111');
        expect(barclays[0].category).toBe('High Street Bank');
        const natwest = searchCuratedLenders('natwest');
        expect(natwest.length).toBeGreaterThan(0);
        expect(natwest[0].name).toContain('NatWest');
        expect(natwest[0].phone).toBe('0345 711 4477');
        const hsbc = searchCuratedLenders('hsbc');
        expect(hsbc.length).toBeGreaterThan(0);
        expect(hsbc[0].name).toContain('HSBC');
    });
    it('matches specialist commercial lenders and challenger banks', () => {
        const shawbrook = searchCuratedLenders('shawbrook');
        expect(shawbrook.length).toBeGreaterThan(0);
        expect(shawbrook[0].name).toContain('Shawbrook');
        expect(shawbrook[0].category).toBe('Specialist Commercial Lender');
        const allica = searchCuratedLenders('allica');
        expect(allica.length).toBeGreaterThan(0);
        expect(allica[0].name).toContain('Allica Bank');
        const oaknorth = searchCuratedLenders('oaknorth');
        expect(oaknorth.length).toBeGreaterThan(0);
        expect(oaknorth[0].name).toContain('OakNorth');
    });
    it('matches building societies', () => {
        const nationwide = searchCuratedLenders('nationwide');
        expect(nationwide.length).toBeGreaterThan(0);
        expect(nationwide[0].name).toContain('Nationwide');
        expect(nationwide[0].category).toBe('Building Society');
        const coventry = searchCuratedLenders('coventry');
        expect(coventry.length).toBeGreaterThan(0);
        expect(coventry[0].name).toContain('Coventry');
    });
    it('returns empty array on empty input or whitespace', () => {
        expect(searchCuratedLenders('')).toEqual([]);
        expect(searchCuratedLenders('   ')).toEqual([]);
    });
    it('asynchronous searchMortgageLenders resolves results', async () => {
        const results = await searchMortgageLenders('santander');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toContain('Santander');
        expect(results[0].phone).toBeTruthy();
    });
});
