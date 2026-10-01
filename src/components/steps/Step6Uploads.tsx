import React, { useState, useEffect } from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { 
  ShieldCheck, 
  CheckCircle2, 
  UploadCloud, 
  Clock, 
  FileText, 
  AlertCircle, 
  RefreshCw, 
  Lock, 
  Building2, 
  FileCheck2, 
  Mail, 
  Phone,
  AlertTriangle
} from 'lucide-react';
import { FileUploadZone } from '../ui/FileUploadZone';

interface UploadTask {
  id: string;
  file?: { name: string; size?: number; type?: string };
  documentType: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
  uploadedAt?: string;
}

interface PortalMetadata {
  submissionRef: string;
  companyName: string;
  requestedDocumentTypes: string[];
  expiresAt?: string;
  existingDocuments: Array<{
    documentType: string;
    fileName: string;
    fileSize?: number;
    uploadedAt?: string;
  }>;
}

const DOCUMENT_CONFIG: Record<string, { label: string; description: string }> = {
  aged_debtor_report: {
    label: 'Current Aged Debtor Report',
    description: 'A breakdown of what your customers owe you, sorted by age.',
  },
  aged_creditor_report: {
    label: 'Current Aged Creditor Report',
    description: 'A breakdown of what you owe to suppliers, sorted by age.',
  },
  bank_statement: {
    label: 'Last 3 Months Business Bank Statements',
    description: 'PDF format preferred. Please provide the main trading account.',
  },
  construction_sample: {
    label: 'Sample Application for Payment / Valuation',
    description: 'A recent sample application for payment or certified valuation (construction only).',
  },
  other_supporting_document: {
    label: 'Other Supporting Documents',
    description: 'Any additional management accounts, contracts, or draft invoices.',
  },
};

export const Step6Uploads: React.FC = () => {
  const { data, nextStep, applicationId, addDocument, uploadToken, turnstileToken } = useApplication();

  const [choice, setChoice] = useState<'now' | 'later' | null>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('token')) {
      return 'now';
    }
    // If arriving from the normal multi-step flow without token in URL, let them choose now/later
    return null;
  });

  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenError, setTokenError] = useState<{ status: string; message: string } | null>(null);
  const [portalData, setPortalData] = useState<PortalMetadata | null>(null);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Validate upload token on load if present
  useEffect(() => {
    const activeToken = uploadToken || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null);
    if (!activeToken) return;

    let isMounted = true;
    setIsValidatingToken(true);

    fetch(`/api/validate-upload-token?token=${encodeURIComponent(activeToken)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!isMounted) return;

        if (json.valid) {
          setPortalData({
            submissionRef: json.submissionRef || 'FF-Application',
            companyName: json.companyName || data.business?.company_name || 'Your Business',
            requestedDocumentTypes: json.requestedDocumentTypes || ['aged_debtor_report', 'aged_creditor_report', 'bank_statement'],
            expiresAt: json.expiresAt,
            existingDocuments: json.existingDocuments || [],
          });

          // Hydrate already-uploaded tasks so page refresh keeps existing upload list
          if (Array.isArray(json.existingDocuments) && json.existingDocuments.length > 0) {
            const existingTasks: UploadTask[] = json.existingDocuments.map((doc: any, idx: number) => ({
              id: `existing-${doc.fileName}-${idx}`,
              file: { name: doc.fileName, size: doc.fileSize },
              documentType: doc.documentType,
              status: 'success',
              progress: 100,
              uploadedAt: doc.uploadedAt,
            }));
            setUploadTasks(existingTasks);
          }
          setChoice('now');
        } else {
          setTokenError({
            status: json.status || 'INVALID',
            message: json.error || 'This upload link is no longer valid or has expired.',
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setTokenError({
          status: 'NETWORK_ERROR',
          message: 'Unable to verify upload link. Please check your internet connection.',
        });
      })
      .finally(() => {
        if (isMounted) setIsValidatingToken(false);
      });

    return () => {
      isMounted = false;
    };
  }, [uploadToken]);

  const processUpload = async (task: UploadTask) => {
    const activeToken = uploadToken || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null);

    try {
      if (!activeToken) {
        throw new Error('Upload session expired or invalid. Please refresh the page.');
      }
      if (!task.file) {
        throw new Error('File data missing.');
      }

      // 1. Get signed Cloud Storage upload URL
      const res = await fetch('/api/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: activeToken,
          fileName: task.file.name,
          fileType: task.file.type || 'application/octet-stream',
          fileSize: task.file.size,
          documentType: task.documentType,
        }),
      });

      const dataRes = await res.json();
      if (!res.ok || !dataRes.success) {
        throw new Error(dataRes.error || dataRes.message || 'Failed to initialize secure upload session.');
      }

      // 2. Direct PUT to Cloud Storage Signed URL with automatic fallback
      let directPutSucceeded = false;
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', dataRes.uploadUrl, true);
          if (task.file?.type) {
            xhr.setRequestHeader('Content-Type', task.file.type);
          }

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = (e.loaded / e.total) * 90;
              setUploadTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, progress } : t)));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              directPutSucceeded = true;
              resolve();
            } else {
              reject(new Error(`Direct storage upload returned status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Direct storage upload failed (CORS or network)'));
          xhr.send((task as any).rawFile);
        });
      } catch (directErr) {
        console.warn('[Upload] Direct storage upload encountered error, falling back to server-side save:', directErr);
      }

      // 3. Record document metadata (and send file payload if direct upload encountered CORS / network rejection)
      const uploadedAt = new Date().toISOString();
      let base64Data: string | undefined;

      if (!directPutSucceeded && (task as any).rawFile) {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
          };
          reader.onerror = () => reject(new Error('Failed to read file for upload fallback.'));
          reader.readAsDataURL((task as any).rawFile);
        });
      }

      const recordRes = await fetch('/api/record-document-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: activeToken,
          document: {
            documentType: task.documentType,
            fileName: task.file.name,
            fileSize: task.file.size,
            fileType: task.file.type || 'application/pdf',
            storagePath: dataRes.storagePath,
            uploadedAt,
            ...(base64Data ? { base64Data } : {}),
          },
        }),
      });

      if (!recordRes.ok) {
        const recErr = await recordRes.json().catch(() => ({}));
        throw new Error(recErr.error || 'Failed to record uploaded document metadata.');
      }

      // 4. Update state to successful
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'success', progress: 100, uploadedAt } : t
        )
      );

      addDocument({
        documentType: task.documentType,
        fileName: task.file.name,
        storagePath: dataRes.storagePath,
        uploadedAt,
        fileSize: task.file.size,
      });
    } catch (err: any) {
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'error', errorMessage: err.message || 'Upload failed' } : t
        )
      );
    }
  };

  const handleFilesSelected = (files: File[], documentType: string) => {
    const newTasks = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      file: { name: file.name, size: file.size, type: file.type },
      rawFile: file,
      documentType,
      status: 'uploading' as const,
      progress: 0,
    }));

    // Deduplicate against existing active tasks
    const existingFileNames = uploadTasks.map((t) => t.file?.name);
    const filteredNewTasks = newTasks.filter((t) => !existingFileNames.includes(t.file.name));

    setUploadTasks((prev) => [...prev, ...filteredNewTasks]);
    filteredNewTasks.forEach((task) => processUpload(task as any));
  };

  const handleRetry = (taskId: string) => {
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: 'uploading', progress: 0, errorMessage: undefined } : t
      )
    );
    const taskToRetry = uploadTasks.find((t) => t.id === taskId);
    if (taskToRetry) {
      processUpload(taskToRetry);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderTaskList = (docType: string) => {
    const tasks = uploadTasks.filter((t) => t.documentType === docType);
    if (tasks.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between p-3.5 bg-surface border border-outline-variant rounded-xl text-left"
          >
            <div className="flex items-center gap-3 overflow-hidden pr-2">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="overflow-hidden">
                <span className="truncate block text-body-m text-on-surface font-medium">
                  {task.file?.name}
                </span>
                {task.file?.size && (
                  <span className="text-body-s text-white/60">{formatFileSize(task.file.size)}</span>
                )}
              </div>
            </div>

            <div className="pl-4 shrink-0">
              {task.status === 'uploading' && (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-200"
                      style={{ width: `${Math.round(task.progress)}%` }}
                    />
                  </div>
                  <span className="text-body-s text-primary font-medium">
                    {Math.round(task.progress)}%
                  </span>
                </div>
              )}

              {task.status === 'success' && (
                <span className="text-body-s text-green-400 font-medium flex items-center gap-1.5 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-400" /> Uploaded
                </span>
              )}

              {task.status === 'error' && (
                <div className="flex items-center gap-2">
                  <span className="text-body-s text-error font-medium flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {task.errorMessage || 'Failed'}
                  </span>
                  <button
                    onClick={() => handleRetry(task.id)}
                    className="text-label-s text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const handleDefer = async () => {
    setIsSendingLink(true);
    try {
      await fetch('/api/send-deferred-upload-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.contact?.email,
          phone: data.contact?.phone,
          applicationId,
          turnstileToken,
        }),
      });
      setLinkSent(true);
      setTimeout(() => {
        nextStep();
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingLink(false);
    }
  };

  const handleCompleteUploads = async () => {
    const activeToken = uploadToken || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null);

    if (activeToken) {
      setIsCompleting(true);
      try {
        await fetch('/api/complete-document-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: activeToken }),
        });
      } catch (err) {
        console.warn('Failed to complete upload session:', err);
      } finally {
        setIsCompleting(false);
      }
    }

    setIsCompleted(true);
  };

  // -------------------------------------------------------------
  // Token Validation Loading State
  // -------------------------------------------------------------
  if (isValidatingToken) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4" />
        <h2 className="title-m text-on-surface mb-2">Verifying Secure Upload Link</h2>
        <p className="body-l text-white/70">Connecting securely to your application record...</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Token Error / Expired / Revoked State
  // -------------------------------------------------------------
  if (tokenError) {
    const isExpired = tokenError.status === 'EXPIRED';
    const isRevoked = tokenError.status === 'REVOKED';
    const isCompletedSession = tokenError.status === 'COMPLETED';

    let errorTitle = 'Upload Link Invalid';
    let errorDescription = tokenError.message;

    if (isExpired) {
      errorTitle = 'Upload Link Expired';
      errorDescription = 'For your security, document upload links expire after 7 days. Please request a new link below.';
    } else if (isRevoked) {
      errorTitle = 'Upload Link Revoked';
      errorDescription = 'This upload link has been cancelled. Please contact your Factoring Finance manager for assistance.';
    } else if (isCompletedSession) {
      errorTitle = 'Upload Session Already Completed';
      errorDescription = 'The documents for this request have already been received and submitted to underwriting.';
    }

    return (
      <div className="max-w-xl mx-auto px-4 py-10 text-center">
        <div className="w-16 h-16 bg-error/15 text-error rounded-full flex items-center justify-center mx-auto mb-6 border border-error/30">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="display-s text-on-surface mb-3">{errorTitle}</h1>
        <p className="body-l text-white/80 mb-8">{errorDescription}</p>

        <div className="p-5 bg-surface border border-outline-variant rounded-2xl text-left mb-8">
          <h3 className="title-m text-on-surface mb-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Need a new upload link?
          </h3>
          <p className="body-l text-white/70 mb-4">
            Contact your underwriting team directly to generate a fresh, secure upload link.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="mailto:enquiries@factoringfinance.co.uk?subject=Request%20New%20Document%20Upload%20Link"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-on-primary label-m rounded-full hover:bg-primary/90 transition-colors"
            >
              <Mail className="w-4 h-4" /> Email Enquiries
            </a>
            <a
              href="tel:01615245050"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-surface border border-outline text-white label-m rounded-full hover:bg-surface-variant transition-colors"
            >
              <Phone className="w-4 h-4" /> Call 0161 524 5050
            </a>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Completed View (Applicant confirmed upload completion)
  // -------------------------------------------------------------
  if (isCompleted) {
    return (
      <div className="max-w-2xl mx-auto px-4 text-center py-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <h1 className="display-s text-on-surface mb-3">Documents Received!</h1>
        <p className="body-l text-white/80 mb-6">
          Thank you. Your documents have been securely attached to your application for{' '}
          <strong className="text-white">{portalData?.companyName || data.business?.company_name || 'your business'}</strong>.
        </p>

        {portalData?.submissionRef && (
          <div className="inline-block px-4 py-2 bg-surface border border-outline-variant rounded-full text-label-m text-white/90 mb-8">
            Reference: <span className="font-mono text-primary font-bold">{portalData.submissionRef}</span>
          </div>
        )}

        <div className="p-6 bg-surface border border-outline-variant rounded-2xl text-left max-w-lg mx-auto">
          <h3 className="title-m text-on-surface mb-2 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-primary" /> What happens next?
          </h3>
          <p className="body-l text-white/80 leading-relaxed mb-4">
            Our underwriting team has been notified. We will review your reports alongside your facility requirements and reach out to you with tailored invoice finance terms.
          </p>
          <div className="text-body-s text-white/60 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" /> All files are stored with AES-256 bank-grade encryption.
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Document Upload Interface (Choice: Now)
  // -------------------------------------------------------------
  if (choice === 'now') {
    const docTypesToRender = portalData?.requestedDocumentTypes || [
      'aged_debtor_report',
      'aged_creditor_report',
      'bank_statement',
      ...(data.business?.industry === 'construction' ? ['construction_sample'] : []),
    ];

    const hasAnyUploads = uploadTasks.some((t) => t.status === 'success');
    const isUploadingAny = uploadTasks.some((t) => t.status === 'uploading');

    return (
      <div className="max-w-3xl mx-auto px-4">
        {/* Header with Case Reference & Company */}
        <div className="mb-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            {portalData?.submissionRef && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-primary/15 border border-primary/30 rounded-full text-label-s text-primary font-mono font-bold">
                Ref: {portalData.submissionRef}
              </span>
            )}
            {portalData?.companyName && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-surface border border-outline-variant rounded-full text-label-s text-white/90">
                <Building2 className="w-3.5 h-3.5 text-primary" /> {portalData.companyName}
              </span>
            )}
          </div>

          <h1 className="display-s text-on-surface mb-2">Upload Supporting Documents</h1>
          <p className="body-l text-white/80 max-w-xl mx-auto">
            Please upload the requested financial documents below to fast-track your invoice finance application.
          </p>

          <div className="flex items-center justify-center gap-4 mt-3 text-body-s text-white/60">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" /> No login required
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-primary" /> 256-bit encrypted
            </span>
          </div>
        </div>

        {/* Upload Zones for Requested Document Types */}
        <div className="space-y-6">
          {docTypesToRender.map((docType) => {
            const config = DOCUMENT_CONFIG[docType] || {
              label: docType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
              description: 'Please upload the requested file.',
            };

            return (
              <div key={docType} className="bg-surface/50 border border-outline-variant/60 rounded-2xl p-5">
                <FileUploadZone
                  label={config.label}
                  description={config.description}
                  onFilesSelected={(files) => handleFilesSelected(files, docType)}
                />
                {renderTaskList(docType)}
              </div>
            );
          })}
        </div>

        {/* Submission Action Bar */}
        <div className="mt-8 flex flex-col items-center justify-center border-t border-outline-variant pt-8 gap-3">
          <button
            onClick={handleCompleteUploads}
            disabled={isCompleting || isUploadingAny}
            className="w-full sm:w-auto px-10 py-4 bg-primary text-on-primary label-m rounded-full hover:bg-primary/90 transition-colors shadow-sm min-h-touch focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCompleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Completing upload...</span>
              </>
            ) : isUploadingAny ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Files currently uploading...</span>
              </>
            ) : (
              <span>{hasAnyUploads ? "I've finished uploading" : 'Continue without documents'}</span>
            )}
          </button>

          <p className="text-body-s text-white/60 text-center">
            You can always return to this link if you need to upload additional files before expiry.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Default Choice Landing (Upload Now vs Send Deferred Link)
  // -------------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto px-4 text-center py-8">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
      </div>
      <h1 className="display-s text-on-surface mb-4">Enquiry submitted successfully</h1>
      <p className="body-l text-white/80 mb-10">
        We have received your details. To fast-track your assessment, our lenders will need to see some standard financial reports.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
        <button
          onClick={() => setChoice('now')}
          className="flex flex-col items-center justify-center p-8 border-2 border-primary rounded-2xl hover:bg-surface-variant transition-colors group focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 min-h-touch cursor-pointer"
        >
          <UploadCloud className="w-12 h-12 text-primary mb-4 group-hover:-translate-y-1 transition-transform" />
          <h3 className="title-m text-on-surface mb-2">Upload them now</h3>
          <p className="body-l text-white/80">I have my reports ready (takes 2 mins)</p>
        </button>

        <button
          onClick={() => {
            setChoice('later');
            handleDefer();
          }}
          disabled={isSendingLink}
          className="flex flex-col items-center justify-center p-8 border-2 border-outline rounded-2xl hover:bg-surface-variant transition-colors group disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 min-h-touch cursor-pointer"
        >
          {linkSent ? (
            <CheckCircle2 className="w-12 h-12 text-primary mb-4" />
          ) : (
            <Clock className="w-12 h-12 text-white/80 mb-4 group-hover:-translate-y-1 transition-transform" />
          )}
          <h3 className="title-m text-on-surface mb-2">
            {linkSent ? 'Link sent!' : "I'll provide them later"}
          </h3>
          <p className="body-l text-white/80">Send me a secure link to upload them another time</p>
        </button>
      </div>
    </div>
  );
};
