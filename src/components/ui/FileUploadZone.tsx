import React, { useRef, useState } from 'react';
import { Upload, FileUp, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { trackDocumentUploadFailed, getFileSizeBucket } from '../../lib/analytics';

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.csv'];
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'text/csv',
  'application/vnd.ms-excel',
  'application/csv',
];

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onError?: (errorMessage: string) => void;
  disabled?: boolean;
  isUploading?: boolean;
  className?: string;
  label?: string;
  description?: string;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesSelected,
  onError,
  disabled = false,
  isUploading = false,
  className,
  label,
  description,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateAndFilterFiles = (fileList: FileList | File[]): File[] => {
    const rawFiles = Array.from(fileList);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of rawFiles) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidType =
        ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);

      if (!isValidType) {
        errors.push(`"${file.name}" is not an accepted format. Only PDF, JPG, JPEG, PNG, and CSV files are supported.`);
        trackDocumentUploadFailed({
          reason: 'invalid_file_format',
          sizeBucket: getFileSizeBucket(file.size),
          fileType: ext.replace('.', ''),
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${file.name}" exceeds the maximum file size of 20 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        trackDocumentUploadFailed({
          reason: 'file_size_exceeded',
          sizeBucket: getFileSizeBucket(file.size),
          fileType: ext.replace('.', ''),
        });
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      const errorMsg = errors.join(' ');
      setValidationError(errorMsg);
      if (onError) onError(errorMsg);
    } else {
      setValidationError(null);
    }

    return validFiles;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const validFiles = validateAndFilterFiles(e.target.files);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
    // Reset file input so user can re-select the same file if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = validateAndFilterFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const triggerPicker = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={clsx('w-full', className)}>
      <div
        role="region"
        aria-label="File upload dropzone"
        tabIndex={disabled ? -1 : 0}
        onClick={triggerPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerPicker();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'relative flex flex-col items-center justify-center p-6 sm:p-10 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 min-h-touch',
          isDragging
            ? 'border-primary bg-primary-container/20 scale-[1.005]'
            : 'border-outline-variant bg-surface-container-low hover:border-primary hover:bg-surface-container-low/80',
          disabled && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.csv,application/pdf,image/jpeg,image/png,text/csv,application/vnd.ms-excel,application/csv"
          onChange={handleFileChange}
          className="sr-only"
          disabled={disabled}
          aria-label="Upload business bank statements"
          id="bank-statements-upload-input"
        />

        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-3 sm:mb-4 shadow-xs">
          <Upload className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2]" aria-hidden="true" />
        </div>

        <div className="text-center max-w-md">
          <p className="title-m text-on-surface">
            {label ? label : (
              <>
                <span className="hidden sm:inline">Drag & drop your files here, or </span>
                <span className="sm:hidden">Upload your files</span>
              </>
            )}
          </p>
          <p className="body-l text-white/80 mt-1">
            {description ? description : 'PDF, CSV, JPG, JPEG, or PNG (up to 20 MB per file)'}
          </p>
        </div>

        {/* Primary Action Button (Optimised for mobile & desktop) */}
        <div className="mt-4 sm:mt-5">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              triggerPicker();
            }}
            disabled={disabled || isUploading}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-touch label-m rounded-full bg-primary text-on-primary shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FileUp className="w-4 h-4 stroke-[2.2]" />
            <span>{isUploading ? 'Uploading statements...' : 'Choose files'}</span>
          </button>
        </div>

        {isUploading && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 inline-flex items-center gap-2 label-m text-primary bg-primary-container border border-outline px-4 py-2 rounded-full min-h-touch"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Securely uploading statement files to cloud storage...</span>
          </div>
        )}
      </div>

      {validationError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-3 flex items-start gap-2.5 p-4 rounded-lg bg-error/10 border border-error/20 text-error body-l"
        >
          <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
