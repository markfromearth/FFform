import React, { useState, useEffect, useRef } from 'react';
import {
  searchCompaniesHouse,
  getCompanyProfile,
  CompaniesHouseCompany,
} from '../../services/companiesHouseService';
import { Search, Building2, CheckCircle2, Loader2, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface CompanySearchInputProps {
  onSelectCompany: (company: CompaniesHouseCompany) => void;
  selectedCompanyNumber?: string;
  selectedCompanyName?: string;
  onClearSelection?: () => void;
}

export const CompanySearchInput: React.FC<CompanySearchInputProps> = ({
  onSelectCompany,
  selectedCompanyNumber,
  selectedCompanyName,
  onClearSelection,
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<CompaniesHouseCompany[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const hits = await searchCompaniesHouse(query);
        setResults(hits);
        setIsOpen(true);
        setHasSearched(true);
      } catch (err) {
        console.error('Error in company search:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = async (company: CompaniesHouseCompany) => {
    setIsLoading(true);
    try {
      // Fetch full profile to get sic_codes and full address if needed
      const fullProfile = await getCompanyProfile(company.company_number);
      onSelectCompany(fullProfile || company);
    } catch {
      onSelectCompany(company);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
      setQuery('');
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onClearSelection?.();
  };

  const isVerified = !!selectedCompanyNumber && !!selectedCompanyName;

  return (
    <div ref={containerRef} className="w-full">
      {/* If already selected & verified with Companies House */}
      {isVerified ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Companies House Verified
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900 font-semibold font-mono">
                    {selectedCompanyNumber}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white mt-0.5">
                  {selectedCompanyName}
                </h4>
                <p className="text-xs text-white/80 mt-0.5">
                  Company details and registered office address loaded from official UK register.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:self-center pl-12 sm:pl-0">
              <a
                href={`https://find-and-update.company-information.service.gov.uk/company/${selectedCompanyNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
              >
                <span>View on Gov Register</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-white/70 hover:text-white px-2.5 py-1 rounded-md hover:bg-emerald-100/50 transition-colors"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="companies_house_search"
              className="text-xs font-semibold uppercase tracking-wider text-brand-700 flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Fast-fill from Companies House UK Registry</span>
            </label>
            <span className="text-[11px] text-white/70 font-medium">Search by name or number</span>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/70">
              <Search className="w-4 h-4" />
            </div>

            <input
              id="companies_house_search"
              name="company_search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setIsOpen(true)}
              placeholder="Start typing company name (e.g. Apex, Tesco, Brewdog) or 8-digit number..."
              className={clsx(
                'w-full pl-10 pr-10 py-2.5 text-sm bg-white/10 border rounded-xl shadow-xs transition-all',
                'border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
                isOpen ? 'rounded-b-none border-brand-400' : ''
              )}
              autoComplete="off"
            />

            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-brand-700" />}
              {query && !isLoading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 text-white/70 hover:text-white/90 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Results Dropdown */}
            {isOpen && (
              <div className="absolute top-full left-0 right-0 z-30 bg-white/10 rounded-b-xl border-x border-b border-brand-400 shadow-elevated max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in-50 duration-100">
                {results.length > 0 ? (
                  results.map((c) => {
                    const isActive = (c.company_status || '').toLowerCase() === 'active';
                    const addressStr = [
                      c.registered_office_address?.address_line_1,
                      c.registered_office_address?.locality,
                      c.registered_office_address?.postal_code,
                    ]
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <button
                        key={c.company_number}
                        type="button"
                        onClick={() => handleSelect(c)}
                        className="w-full p-3.5 text-left hover:bg-brand-50/60 transition-colors flex items-start justify-between gap-3 group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white group-hover:text-brand-700 transition-colors">
                              {c.company_name}
                            </span>
                            <span
                              className={clsx(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize',
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-white/80'
                              )}
                            >
                              {c.company_status || 'Registered'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-white/70">
                            <span className="font-mono font-medium text-white/90">
                              {c.company_number}
                            </span>
                            <span>•</span>
                            <span className="capitalize">{c.company_type || 'Ltd'}</span>
                            {c.date_of_creation && (
                              <>
                                <span>•</span>
                                <span>Inc. {c.date_of_creation.slice(0, 4)}</span>
                              </>
                            )}
                          </div>

                          {addressStr && (
                            <p className="text-xs text-white/70 mt-1 truncate">
                              {addressStr}
                            </p>
                          )}
                        </div>

                        <span className="text-xs font-semibold text-brand-600 shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                          Select →
                        </span>
                      </button>
                    );
                  })
                ) : hasSearched ? (
                  <div className="p-4 text-center text-xs text-white/70">
                    No matching UK companies found. You can enter details manually below.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
