export interface PhysicalAddress {
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
}

export interface Principal {
  id: string;
  name: string;
  title: string;
  ownershipPercentage: number | null;
  homeAddress: PhysicalAddress;
  currentAddressStartMonthYear?: string;
  hasLivedThreeYears: boolean | null;
  previousAddress?: PhysicalAddress;
  previousAddressFrom?: string; // MM/YY
  previousAddressTo?: string;   // MM/YY
  dateOfBirth: string;          // DD/MM/YYYY
  email: string;
  mobilePhone: string;
}

export type LegalEntityType = 'PLC' | 'Ltd Co' | 'LLP' | 'Other' | '';

export type BusinessClassificationType =
  | 'Retail'
  | 'Restaurant'
  | 'Services'
  | 'Manufacturer/Wholesaler'
  | 'Internet'
  | 'Mail Order/Telephone Order'
  | '';

export interface BusinessDetails {
  legalName: string;
  hasTradingName: boolean;
  tradingName?: string;
  startDate: string; // DD/MM/YYYY
  legalEntity: LegalEntityType;
  legalEntityOther?: string;
  classification: BusinessClassificationType;
  productsSold: string;
  physicalAddress: PhysicalAddress;
  isMailingSameAsPhysical: boolean;
  mailingAddress?: PhysicalAddress;
  businessPhone: string;
  mobilePhone: string;
  website: string;
  registrationNumber: string;
  acceptsCardPayments: boolean | null;
  posMakeModel?: string;
  acquiringBank?: string;
  ownershipType: 'Lease' | 'Own' | '';
  ownershipLengthYears: number | null;
  ownershipLengthMonths: number | null;
  leaseEndDate?: string;
  hasLandlordOrMortgage: boolean | null;
  landlordMortgageCompany?: string;
  landlordMortgageContact?: string;
  landlordMortgagePhone?: string;
  monthlyRentMortgage?: number | null;
}

export interface Financials {
  averageMonthlyCardSales: number | null;
  totalMonthlySales: number | null;
  annualGrossSales: number | null;
  overdraftLimit: number | null;
}

export interface Funding {
  requestedAmount: number | null;
  useOfFunds: string;
  hasExistingLoanOrAdvance: boolean | null;
  outstandingBalance?: number | null;
  currentProvider?: string;
}

export interface SignatureEntry {
  principalId: string;
  principalName: string;
  signatureType: 'draw' | 'type';
  signatureData: string; // base64 data URL or typed name
  signedAt: string;      // ISO 8601 string
}

export interface Certification {
  confirmed: boolean;
  signatures: SignatureEntry[];
  signedAt?: string;
}

export interface Authorisation {
  confirmed: boolean;
  signatures: SignatureEntry[];
  signedAt?: string;
}

export interface RegisteredPrincipal {
  id: string;
  name: string;
  title: string;
  ownershipPercentage: number | null;
  dateOfBirthMonthYear?: { month: number; year: number };
  dateOfBirthFormatted?: string; // DD/MM/YYYY with day defaulted/prompted
  homeAddress?: PhysicalAddress;
  source: 'Companies House PSC' | 'Companies House Officer';
  role?: string;
  isMajorityController?: boolean;
}

export interface StatementPeriod {
  month: number; // 1 to 12
  year: number;  // 4-digit year, e.g. 2026
}

export type UploadStatus = 'uploading' | 'uploaded' | 'failed';

export interface BankStatementDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadStatus: UploadStatus;
  uploadProgress?: number; // 0 to 100
  errorMessage?: string;
  detectedPeriods: StatementPeriod[];
  manuallyConfirmedPeriods?: StatementPeriod[];
  uploadedAt: string;
  storagePath?: string;
}

export type MonthCoverageStatus = 'covered' | 'missing' | 'ambiguous' | 'duplicate';

export interface MonthCoverageItem {
  month: number;
  year: number;
  status: MonthCoverageStatus;
  documentIds?: string[];
}

export interface BankStatementCoverage {
  months: MonthCoverageItem[];
  consecutiveMonths: number;
  isComplete: boolean;
  startDate?: StatementPeriod;
  endDate?: StatementPeriod;
}

export interface BankStatementsData {
  requiredMonths: number; // 6
  documents: BankStatementDocument[];
  coverage: BankStatementCoverage;
}

export interface ManagementAccountDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadStatus: UploadStatus;
  uploadProgress?: number;
  errorMessage?: string;
  uploadedAt: string;
  storagePath?: string;
}

export interface ManagementAccountsData {
  documents: ManagementAccountDocument[];
}

export interface Application {
  id: string;
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
  currentStep: number;
  maxCompletedStep: number;
  numPrincipals: 1 | 2 | 3 | 4;
  business: BusinessDetails;
  principals: Principal[];
  financials: Financials;
  funding: Funding;
  bankStatements: BankStatementsData;
  managementAccounts: ManagementAccountsData;
  certification: Certification;
  authorisation: Authorisation;
  submissionRef?: string;
  submittedAt?: string;
  emailStatus?: 'pending' | 'sent' | 'failed';
  emailMessageId?: string;
  emailSentAt?: string;
  prepopulatedFields?: Record<string, string>;
  registeredPrincipals?: RegisteredPrincipal[];
}

export interface SubmissionResult {
  success: boolean;
  applicationId: string;
  submissionRef: string;
  submittedAt: string;
  emailStatus?: 'pending' | 'sent' | 'failed';
  isMock?: boolean;
}

