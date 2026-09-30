import React, { useState } from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { ShieldCheck, CheckCircle2, UploadCloud, Clock, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { FileUploadZone } from '../ui/FileUploadZone';


interface UploadTask {
  id: string;
  file: File;
  documentType: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
}

export const Step6Uploads: React.FC = () => {
  const { data, nextStep, applicationId, addDocument, uploadToken, turnstileToken } = useApplication();
  const [choice, setChoice] = useState<'now' | 'later' | null>(null);

  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

  const processUpload = async (task: UploadTask) => {
    try {
      if (!uploadToken) { throw new Error('Upload session expired or invalid'); }
      const res = await fetch('/api/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: uploadToken,
          fileName: task.file.name,
          fileType: task.file.type,
          fileSize: task.file.size,
          documentType: task.documentType
        })
      });
      
      const dataRes = await res.json();
      if (!dataRes.success) throw new Error(dataRes.error || dataRes.message || 'Failed to get upload URL');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', dataRes.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', task.file.type);
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploadTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress } : t));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'success', progress: 100 } : t));
            addDocument({
              documentType: task.documentType,
              fileName: task.file.name,
              storagePath: dataRes.storagePath,
              uploadedAt: new Date().toISOString(),
              fileSize: task.file.size
            });
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(task.file);
      });
    } catch (err: any) {
      setUploadTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error', errorMessage: err.message } : t));
    }
  };

  const handleFilesSelected = (files: File[], documentType: string) => {
    const newTasks = files.map(file => ({
      id: `${file.name}-${Date.now()}`,
      file,
      documentType,
      status: 'uploading' as const,
      progress: 0
    }));
    
    // Check for duplicates
    const existingFileNames = uploadTasks.map(t => t.file.name);
    const filteredNewTasks = newTasks.filter(t => !existingFileNames.includes(t.file.name));

    setUploadTasks(prev => [...prev, ...filteredNewTasks]);
    
    filteredNewTasks.forEach(task => processUpload(task));
  };

  const handleRetry = (taskId: string) => {
    setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading', progress: 0, errorMessage: undefined } : t));
    const taskToRetry = uploadTasks.find(t => t.id === taskId);
    if (taskToRetry) {
      processUpload(taskToRetry);
    }
  };

  const renderTaskList = (docType: string) => {
    const tasks = uploadTasks.filter(t => t.documentType === docType);
    if (tasks.length === 0) return null;
    return (
      <div className="mt-3 space-y-2">
        {tasks.map(task => (
          <div key={task.id} className="flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg text-left">
            <div className="flex items-center gap-3 overflow-hidden">
               <FileText className="w-5 h-5 text-primary shrink-0" />
               <span className="truncate text-body-m text-on-surface">{task.file.name}</span>
            </div>
            <div className="pl-4 shrink-0">
              {task.status === 'uploading' && <span className="text-body-s text-primary font-medium">Uploading {Math.round(task.progress)}%</span>}
              {task.status === 'success' && <span className="text-body-s text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Uploaded</span>}
              {task.status === 'error' && (
                 <div className="flex items-center gap-2">
                   <span className="field-error"><AlertCircle className="w-4 h-4" /> Failed</span>
                   <button onClick={() => handleRetry(task.id)} className="text-label-s text-primary hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3"/> Retry</button>
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
      // Simulate API call to send a deferred link
      await fetch('/api/send-deferred-upload-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
          email: data.contact?.email,
          phone: data.contact?.phone,
          applicationId,
          turnstileToken
        })
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

  const handleCompleteUploads = () => {
    nextStep();
  };

  if (choice === 'now') {
    return (
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="display-s text-on-surface mb-3">Upload your documents</h1>
          <p className="body-l text-white/80">Providing these now will fast-track your application.</p>
        </div>
        
        
        <div className="space-y-8">
          <div>
            <FileUploadZone 
              label="Current Aged Debtor Report" 
              description="A breakdown of what your customers owe you, sorted by age."
              onFilesSelected={(files) => handleFilesSelected(files, 'aged_debtor_report')}
            />
            {renderTaskList('aged_debtor_report')}
          </div>
          <div>
            <FileUploadZone 
              label="Current Aged Creditor Report" 
              description="A breakdown of what you owe to suppliers, sorted by age."
              onFilesSelected={(files) => handleFilesSelected(files, 'aged_creditor_report')}
            />
            {renderTaskList('aged_creditor_report')}
          </div>
          <div>
            <FileUploadZone 
              label="Last 3 Months Business Bank Statements" 
              description="PDF format preferred. Please provide the main trading account."
              onFilesSelected={(files) => handleFilesSelected(files, 'bank_statement')}
            />
            {renderTaskList('bank_statement')}
          </div>
          {data.business?.industry === 'construction' && (
            <div>
              <FileUploadZone 
                label="Sample application for payment or certified valuation (construction only)" 
                description="Please provide a recent example."
                onFilesSelected={(files) => handleFilesSelected(files, 'construction_sample')}
              />
              {renderTaskList('construction_sample')}
            </div>
          )}
        </div>


        <div className="mt-8 flex justify-center border-t border-outline-variant pt-8">
          <button
            onClick={handleCompleteUploads}
            className="px-8 py-4 bg-primary text-on-primary label-m rounded-full hover:bg-primary/90 transition-colors shadow-sm min-h-touch focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            I've finished uploading
          </button>
        </div>
      </div>
    );
  }

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
          className="flex flex-col items-center justify-center p-8 border-2 border-primary rounded-2xl hover:bg-surface-variant transition-colors group focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 min-h-touch"
        >
          <UploadCloud className="w-12 h-12 text-primary mb-4 group-hover:-translate-y-1 transition-transform" />
          <h3 className="title-m text-on-surface mb-2">Upload them now</h3>
          <p className="body-l text-white/80">I have my reports ready (takes 2 mins)</p>
        </button>

        <button 
          onClick={() => { setChoice('later'); handleDefer(); }}
          disabled={isSendingLink}
          className="flex flex-col items-center justify-center p-8 border-2 border-outline rounded-2xl hover:bg-surface-variant transition-colors group disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 min-h-touch"
        >
          {linkSent ? (
            <CheckCircle2 className="w-12 h-12 text-primary mb-4" />
          ) : (
            <Clock className="w-12 h-12 text-white/80 mb-4 group-hover:-translate-y-1 transition-transform" />
          )}
          <h3 className="title-m text-on-surface mb-2">{linkSent ? 'Link sent!' : "I'll provide them later"}</h3>
          <p className="body-l text-white/80">Send me a secure link to upload them another time</p>
        </button>
      </div>
    </div>
  );
};
