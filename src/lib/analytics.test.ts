import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STEP_IDS,
  getDeviceType,
  getScreenBucket,
  getFileSizeBucket,
  categorizeError,
  getAnalyticsLog,
  clearAnalyticsLog,
  safeTrack,
  trackJourneyStarted,
  trackJourneyResumed,
  trackJourneyCompleted,
  trackStepViewed,
  trackStepStarted,
  trackStepCompleted,
  trackStepAbandoned,
  trackStepBack,
  trackStepRevisited,
  trackFieldFocused,
  trackFieldCompleted,
  trackFieldCleared,
  trackValidationError,
  trackFieldCorrected,
  trackConditionalBranchEntered,
  trackDocumentUploadStarted,
  trackDocumentUploadCompleted,
  trackDocumentUploadFailed,
  trackDocumentUploadRemoved,
  trackReviewViewed,
  trackReviewEditClicked,
  trackReviewReadyToSubmit,
  trackApplicationSubmitAttempted,
  trackApplicationSubmitSucceeded,
  trackApplicationSubmitFailed,
} from './analytics';

describe('Vercel Analytics Behavioral Telemetry', () => {
  beforeEach(() => {
    clearAnalyticsLog();
  });

  describe('Step ID Definitions', () => {
    it('maps all 14 steps to consistent, human-readable IDs', () => {
      expect(STEP_IDS[1]).toBe('welcome');
      expect(STEP_IDS[2]).toBe('business_profile');
      expect(STEP_IDS[3]).toBe('contact_information');
      expect(STEP_IDS[4]).toBe('registration_payments');
      expect(STEP_IDS[5]).toBe('premises_occupancy');
      expect(STEP_IDS[6]).toBe('owners_principals');
      expect(STEP_IDS[7]).toBe('address_history');
      expect(STEP_IDS[8]).toBe('sales_financials');
      expect(STEP_IDS[9]).toBe('funding_requirement');
      expect(STEP_IDS[10]).toBe('bank_statements');
      expect(STEP_IDS[11]).toBe('review_application');
      expect(STEP_IDS[12]).toBe('certification_consent');
      expect(STEP_IDS[13]).toBe('general_authorisation');
      expect(STEP_IDS[14]).toBe('confirmation');
      expect(Object.keys(STEP_IDS).length).toBe(14);
    });
  });

  describe('Device & Viewport Classifier', () => {
    it('classifies mobile viewports (<640px)', () => {
      vi.stubGlobal('innerWidth', 375);
      expect(getDeviceType()).toBe('mobile');
      expect(getScreenBucket()).toBe('<640px');
    });

    it('classifies tablet viewports (640-1024px)', () => {
      vi.stubGlobal('innerWidth', 768);
      expect(getDeviceType()).toBe('tablet');
      expect(getScreenBucket()).toBe('640-1024px');
    });

    it('classifies desktop viewports (>1024px)', () => {
      vi.stubGlobal('innerWidth', 1440);
      expect(getDeviceType()).toBe('desktop');
      expect(getScreenBucket()).toBe('>1024px');
    });
  });

  describe('File Size Bucketing (Zero-PII)', () => {
    it('categorizes sizes into standardized non-identifiable buckets', () => {
      expect(getFileSizeBucket(500 * 1024)).toBe('<1MB');
      expect(getFileSizeBucket(2 * 1024 * 1024)).toBe('1-5MB');
      expect(getFileSizeBucket(8 * 1024 * 1024)).toBe('5-10MB');
      expect(getFileSizeBucket(15 * 1024 * 1024)).toBe('10-25MB');
      expect(getFileSizeBucket(30 * 1024 * 1024)).toBe('>25MB');
    });
  });

  describe('Error Categorization (Zero-PII)', () => {
    it('categorizes required validation errors', () => {
      expect(categorizeError('Company name is required')).toBe('required');
      expect(categorizeError('Please select an option')).toBe('required');
      expect(categorizeError('Must be provided')).toBe('required');
    });

    it('categorizes email errors', () => {
      expect(categorizeError('Please enter a valid email address')).toBe('invalid_email');
    });

    it('categorizes phone errors', () => {
      expect(categorizeError('Invalid mobile telephone format')).toBe('invalid_phone');
    });

    it('categorizes format/postcode errors', () => {
      expect(categorizeError('Invalid postcode format')).toBe('invalid_format');
    });

    it('categorizes numeric and percentage errors', () => {
      expect(categorizeError('Must be greater than 0')).toBe('invalid_number');
      expect(categorizeError('Total percentage must equal 100%')).toBe('invalid_number');
    });

    it('categorizes date and period errors', () => {
      expect(categorizeError('Trading start date is invalid')).toBe('invalid_date');
      expect(categorizeError('Confirm period covered')).toBe('invalid_date');
    });

    it('categorizes signature errors', () => {
      expect(categorizeError('All principals must provide an electronic signature')).toBe('missing_signature');
    });

    it('categorizes document upload and file errors', () => {
      expect(categorizeError('Exceeds 20 MB size limit')).toBe('file_size');
      expect(categorizeError('Only PDF and image formats supported')).toBe('file_type');
      expect(categorizeError('Must cover at least 6 consecutive months without gaps')).toBe('insufficient_coverage');
    });

    it('returns unspecified for undefined or unknown errors', () => {
      expect(categorizeError()).toBe('unspecified');
      expect(categorizeError('Some obscure error message')).toBe('unspecified');
    });
  });

  describe('Behavioral Lifecycle Events', () => {
    it('dispatches journey_started with device telemetry', () => {
      trackJourneyStarted('hero_cta');
      const log = getAnalyticsLog();
      expect(log).toHaveLength(1);
      expect(log[0].eventName).toBe('journey_started');
      expect(log[0].properties?.source).toBe('hero_cta');
      expect(log[0].properties?.device_type).toBeDefined();
    });

    it('dispatches journey_resumed with step context', () => {
      trackJourneyResumed(5);
      const log = getAnalyticsLog();
      expect(log[0].eventName).toBe('journey_resumed');
      expect(log[0].properties?.step_number).toBe(5);
      expect(log[0].properties?.step_id).toBe('premises_occupancy');
    });

    it('dispatches journey_completed with total duration', () => {
      trackJourneyCompleted(320.6);
      const log = getAnalyticsLog();
      expect(log[0].eventName).toBe('journey_completed');
      expect(log[0].properties?.total_duration_seconds).toBe(321);
    });

    it('dispatches step_viewed and step_completed with timings and attempts', () => {
      trackStepViewed({ stepNumber: 2, previousStep: 1, revisitCount: 1 });
      trackStepCompleted({ stepNumber: 2, durationSeconds: 24.52, validationAttempts: 1 });

      const log = getAnalyticsLog();
      expect(log).toHaveLength(2);
      expect(log[0].eventName).toBe('step_viewed');
      expect(log[0].properties?.step_id).toBe('business_profile');
      expect(log[0].properties?.revisit_count).toBe(1);

      expect(log[1].eventName).toBe('step_completed');
      expect(log[1].properties?.step_duration_seconds).toBe(24.5);
      expect(log[1].properties?.validation_attempts).toBe(1);
    });

    it('dispatches step_back and step_revisited on backward navigation', () => {
      trackStepBack({ fromStep: 6, toStep: 5, reason: 'previous_button' });
      trackStepRevisited({ stepNumber: 5, visitCount: 2, source: 'back' });

      const log = getAnalyticsLog();
      expect(log[0].eventName).toBe('step_back');
      expect(log[0].properties?.from_step_id).toBe('owners_principals');
      expect(log[0].properties?.to_step_id).toBe('premises_occupancy');

      expect(log[1].eventName).toBe('step_revisited');
      expect(log[1].properties?.step_number).toBe(5);
      expect(log[1].properties?.visit_count).toBe(2);
    });

    it('dispatches step_abandoned when Save & Exit is engaged', () => {
      trackStepAbandoned({ stepNumber: 8, reason: 'save_and_exit_modal' });
      const log = getAnalyticsLog();
      expect(log[0].eventName).toBe('step_abandoned');
      expect(log[0].properties?.step_id).toBe('sales_financials');
      expect(log[0].properties?.reason).toBe('save_and_exit_modal');
    });
  });

  describe('Hesitation, Friction & Error Recovery Telemetry', () => {
    it('tracks field focus, completion duration, and clearing without PII values', () => {
      trackFieldFocused('legalName', 'text');
      trackFieldCompleted({ fieldId: 'legalName', fieldType: 'text', timeToCompleteSeconds: 4.82 });
      trackFieldCleared('legalName', 'text');

      const log = getAnalyticsLog();
      expect(log).toHaveLength(3);
      expect(log[0].eventName).toBe('field_focused');
      expect(log[0].properties?.field_id).toBe('legalName');

      expect(log[1].eventName).toBe('field_completed');
      expect(log[1].properties?.field_time_to_complete).toBe(4.8);

      expect(log[2].eventName).toBe('field_cleared');
      expect(log[2].properties?.field_id).toBe('legalName');
    });

    it('tracks validation errors and successful correction recovery', () => {
      trackValidationError({
        stepNumber: 3,
        fieldId: 'email',
        errorType: 'invalid_email',
      });
      trackFieldCorrected({
        stepNumber: 3,
        fieldId: 'email',
        previousErrorType: 'invalid_email',
        timeToCorrectSeconds: 12.35,
      });

      const log = getAnalyticsLog();
      expect(log[0].eventName).toBe('validation_error');
      expect(log[0].properties?.field_id).toBe('email');
      expect(log[0].properties?.error_type).toBe('invalid_email');

      expect(log[1].eventName).toBe('field_corrected');
      expect(log[1].properties?.field_id).toBe('email');
      expect(log[1].properties?.time_to_correct_seconds).toBe(12.4);
    });
  });

  describe('Conditional Branching Telemetry', () => {
    it('tracks conditional branch activations', () => {
      trackConditionalBranchEntered({ branchName: 'card_facilities', stepNumber: 4 });
      trackConditionalBranchEntered({ branchName: 'two_principals', stepNumber: 6 });
      trackConditionalBranchEntered({ branchName: 'ambiguous_statement_modal', stepNumber: 10 });

      const log = getAnalyticsLog();
      expect(log).toHaveLength(3);
      expect(log[0].properties?.branch_name).toBe('card_facilities');
      expect(log[1].properties?.branch_name).toBe('two_principals');
      expect(log[2].properties?.branch_name).toBe('ambiguous_statement_modal');
    });
  });

  describe('Document Upload & Friction Telemetry', () => {
    it('tracks upload starts, successes, failures, and removals', () => {
      trackDocumentUploadStarted({ fileCount: 3, sizeBucket: '5-10MB' });
      trackDocumentUploadCompleted({ fileCount: 3, coverageMonths: 6, isComplete: true, durationSeconds: 2.1 });
      trackDocumentUploadFailed({ reason: 'invalid_file_format', sizeBucket: '<1MB', fileType: 'exe' });
      trackDocumentUploadRemoved({ reason: 'user_removed' });

      const log = getAnalyticsLog();
      expect(log).toHaveLength(4);
      expect(log[0].eventName).toBe('document_upload_started');
      expect(log[0].properties?.total_size_bucket).toBe('5-10MB');

      expect(log[1].eventName).toBe('document_upload_completed');
      expect(log[1].properties?.coverage_months).toBe(6);
      expect(log[1].properties?.is_complete).toBe(true);

      expect(log[2].eventName).toBe('document_upload_failed');
      expect(log[2].properties?.file_type).toBe('exe');

      expect(log[3].eventName).toBe('document_upload_removed');
    });
  });

  describe('Review & Submission Funnel', () => {
    it('tracks review view and specific section edit clicks', () => {
      trackReviewViewed();
      trackReviewEditClicked('bank_statements', 10);
      trackReviewReadyToSubmit();

      const log = getAnalyticsLog();
      expect(log[0].eventName).toBe('review_viewed');
      expect(log[1].eventName).toBe('review_edit_clicked');
      expect(log[1].properties?.section_id).toBe('bank_statements');
      expect(log[1].properties?.target_step_id).toBe('bank_statements');
      expect(log[2].eventName).toBe('review_ready_to_submit');
    });

    it('tracks application submit attempts, failures, and successes', () => {
      trackApplicationSubmitAttempted();
      trackApplicationSubmitFailed({ errorCount: 2, stepNumber: 13 });
      trackApplicationSubmitSucceeded(14);

      const log = getAnalyticsLog();
      expect(log[0].eventName).toBe('application_submit_attempted');
      expect(log[1].eventName).toBe('application_submit_failed');
      expect(log[1].properties?.error_count).toBe(2);
      expect(log[2].eventName).toBe('application_submit_succeeded');
      expect(log[2].properties?.total_steps).toBe(14);
    });
  });

  describe('Robustness & Safe Execution', () => {
    it('never throws even if invalid arguments or exceptions occur', () => {
      expect(() => {
        safeTrack('test_event', { nullProp: null as any, undefinedProp: undefined as any });
      }).not.toThrow();
    });
  });
});
