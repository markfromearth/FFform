import { track } from '@vercel/analytics';
export const STEP_IDS = {
    1: 'welcome',
    2: 'business_profile',
    3: 'contact_information',
    4: 'registration_payments',
    5: 'premises_occupancy',
    6: 'owners_principals',
    7: 'address_history',
    8: 'sales_financials',
    9: 'funding_requirement',
    10: 'bank_statements',
    11: 'review_application',
    12: 'certification_consent',
    13: 'general_authorisation',
    14: 'confirmation',
};
export const getDeviceType = () => {
    if (typeof window === 'undefined')
        return 'desktop';
    const width = window.innerWidth;
    if (width < 640)
        return 'mobile';
    if (width <= 1024)
        return 'tablet';
    return 'desktop';
};
export const getScreenBucket = () => {
    if (typeof window === 'undefined')
        return '>1024px';
    const width = window.innerWidth;
    if (width < 640)
        return '<640px';
    if (width <= 1024)
        return '640-1024px';
    return '>1024px';
};
export const getFileSizeBucket = (bytes) => {
    if (bytes < 1024 * 1024)
        return '<1MB';
    if (bytes <= 5 * 1024 * 1024)
        return '1-5MB';
    if (bytes <= 10 * 1024 * 1024)
        return '5-10MB';
    if (bytes <= 25 * 1024 * 1024)
        return '10-25MB';
    return '>25MB';
};
export const categorizeError = (errorMessage) => {
    if (!errorMessage)
        return 'unspecified';
    const lower = errorMessage.toLowerCase();
    // Strict required checks
    if (lower.includes('required') || lower.includes('must be provided') || lower.includes('must provide')) {
        if (lower.includes('signature'))
            return 'missing_signature';
        return 'required';
    }
    // Specific domain formats
    if (lower.includes('email')) {
        return 'invalid_email';
    }
    if (lower.includes('phone') || lower.includes('mobile')) {
        return 'invalid_phone';
    }
    if (lower.includes('size') || lower.includes('20 mb') || lower.includes('too large')) {
        return 'file_size';
    }
    if (lower.includes('pdf') || lower.includes('image') || lower.includes('file format') || lower.includes('accepted format') || lower.includes('supported format')) {
        return 'file_type';
    }
    if (lower.includes('coverage') || lower.includes('consecutive') || lower.includes('gaps')) {
        return 'insufficient_coverage';
    }
    if (lower.includes('signature')) {
        return 'missing_signature';
    }
    if (lower.includes('date') || lower.includes('year') || lower.includes('month') || lower.includes('period')) {
        return 'invalid_date';
    }
    if (lower.includes('number') || lower.includes('numeric') || lower.includes('greater than') || lower.includes('less than') || lower.includes('positive') || lower.includes('percentage')) {
        return 'invalid_number';
    }
    if (lower.includes('postcode') || lower.includes('format') || lower.includes('pattern')) {
        return 'invalid_format';
    }
    if (lower.includes('please enter') || lower.includes('please select') || lower.includes('please provide')) {
        return 'required';
    }
    return 'unspecified';
};
// In-memory event log for verification and testing
const eventLog = [];
export const getAnalyticsLog = () => [...eventLog];
export const clearAnalyticsLog = () => {
    eventLog.length = 0;
};
/**
 * Safe event dispatch wrapper around Vercel Analytics track().
 * Guarantees zero unhandled exceptions in ad-blocked, offline, or test environments.
 */
export const safeTrack = (eventName, properties) => {
    try {
        const cleanProperties = {};
        if (properties) {
            for (const [key, value] of Object.entries(properties)) {
                if (value !== null && value !== undefined) {
                    cleanProperties[key] = value;
                }
            }
        }
        eventLog.push({
            eventName,
            properties: cleanProperties,
            timestamp: new Date().toISOString(),
        });
        track(eventName, cleanProperties);
    }
    catch (err) {
        if (process.env.NODE_ENV === 'development') {
            console.warn(`[Vercel Analytics] Failed to track "${eventName}":`, err);
        }
    }
};
// ==========================================
// Strongly Typed Behavioral Event Trackers
// ==========================================
export const trackJourneyStarted = (source = 'web') => {
    safeTrack('journey_started', {
        source,
        device_type: getDeviceType(),
        screen_bucket: getScreenBucket(),
    });
};
export const trackJourneyResumed = (stepNumber) => {
    safeTrack('journey_resumed', {
        step_number: stepNumber,
        step_id: STEP_IDS[stepNumber] || `step_${stepNumber}`,
        device_type: getDeviceType(),
    });
};
export const trackJourneyCompleted = (totalDurationSeconds) => {
    safeTrack('journey_completed', {
        total_duration_seconds: totalDurationSeconds ? Math.round(totalDurationSeconds) : undefined,
        device_type: getDeviceType(),
    });
};
export const trackStepViewed = (params) => {
    safeTrack('step_viewed', {
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
        previous_step: params.previousStep,
        previous_step_id: params.previousStep ? STEP_IDS[params.previousStep] : undefined,
        revisit_count: params.revisitCount,
        device_type: getDeviceType(),
        screen_bucket: getScreenBucket(),
    });
};
export const trackStepStarted = (params) => {
    safeTrack('step_started', {
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
    });
};
export const trackStepCompleted = (params) => {
    safeTrack('step_completed', {
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
        step_duration_seconds: Math.round(params.durationSeconds * 10) / 10,
        validation_attempts: params.validationAttempts,
    });
};
export const trackStepAbandoned = (params) => {
    safeTrack('step_abandoned', {
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
        reason: params.reason || 'exit',
    });
};
export const trackStepBack = (params) => {
    safeTrack('step_back', {
        from_step: params.fromStep,
        from_step_id: STEP_IDS[params.fromStep] || `step_${params.fromStep}`,
        to_step: params.toStep,
        to_step_id: STEP_IDS[params.toStep] || `step_${params.toStep}`,
        reason: params.reason || 'previous_button',
    });
};
export const trackStepRevisited = (params) => {
    safeTrack('step_revisited', {
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
        visit_count: params.visitCount,
        source: params.source || 'back',
    });
};
export const trackFieldFocused = (fieldId, fieldType) => {
    safeTrack('field_focused', {
        field_id: fieldId,
        field_type: fieldType || 'text',
    });
};
export const trackFieldCompleted = (params) => {
    safeTrack('field_completed', {
        field_id: params.fieldId,
        field_type: params.fieldType || 'text',
        field_time_to_complete: Math.round(params.timeToCompleteSeconds * 10) / 10,
    });
};
export const trackFieldCleared = (fieldId, fieldType) => {
    safeTrack('field_cleared', {
        field_id: fieldId,
        field_type: fieldType || 'text',
    });
};
export const trackValidationError = (params) => {
    safeTrack('validation_error', {
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
        field_id: params.fieldId,
        error_type: params.errorType,
    });
};
export const trackFieldCorrected = (params) => {
    safeTrack('field_corrected', {
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
        field_id: params.fieldId,
        previous_error_type: params.previousErrorType,
        time_to_correct_seconds: params.timeToCorrectSeconds
            ? Math.round(params.timeToCorrectSeconds * 10) / 10
            : undefined,
    });
};
export const trackConditionalBranchEntered = (params) => {
    safeTrack('conditional_branch_entered', {
        branch_name: params.branchName,
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
    });
};
export const trackDocumentUploadStarted = (params) => {
    safeTrack('document_upload_started', {
        file_count: params.fileCount,
        total_size_bucket: params.sizeBucket,
    });
};
export const trackDocumentUploadCompleted = (params) => {
    safeTrack('document_upload_completed', {
        file_count: params.fileCount,
        coverage_months: params.coverageMonths,
        is_complete: params.isComplete,
        duration_seconds: params.durationSeconds
            ? Math.round(params.durationSeconds * 10) / 10
            : undefined,
    });
};
export const trackDocumentUploadFailed = (params) => {
    safeTrack('document_upload_failed', {
        failure_reason: params.reason,
        size_bucket: params.sizeBucket,
        file_type: params.fileType,
    });
};
export const trackDocumentUploadRemoved = (params) => {
    safeTrack('document_upload_removed', {
        reason: params?.reason || 'user_removed',
    });
};
export const trackReviewViewed = () => {
    safeTrack('review_viewed', {
        step_number: 11,
        step_id: 'review_application',
    });
};
export const trackReviewEditClicked = (sectionId, targetStep) => {
    safeTrack('review_edit_clicked', {
        section_id: sectionId,
        target_step: targetStep,
        target_step_id: STEP_IDS[targetStep] || `step_${targetStep}`,
    });
};
export const trackReviewReadyToSubmit = () => {
    safeTrack('review_ready_to_submit', {
        step_number: 11,
    });
};
export const trackApplicationSubmitAttempted = () => {
    safeTrack('application_submit_attempted', {
        step_number: 13,
        step_id: 'general_authorisation',
    });
};
export const trackApplicationSubmitSucceeded = (totalSteps = 14) => {
    safeTrack('application_submit_succeeded', {
        status: 'submitted',
        total_steps: totalSteps,
    });
};
export const trackApplicationSubmitFailed = (params) => {
    safeTrack('application_submit_failed', {
        error_count: params.errorCount,
        step_number: params.stepNumber,
        step_id: STEP_IDS[params.stepNumber] || `step_${params.stepNumber}`,
    });
};
