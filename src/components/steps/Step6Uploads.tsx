import React, { useState } from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { ShieldCheck, CheckCircle2, UploadCloud, Clock } from 'lucide-react';
import { FileUploadZone } from '../ui/FileUploadZone';

export const Step6Uploads: React.FC = () => {
  const { data, nextStep } = useApplication();
  const [choice, setChoice] = useState<'now' | 'later' | null>(null);
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
          applicationId: 'deferred-' + Date.now() // Usually we would get the actual ID from the submit response or context
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
          <p className="body-l text-on-surface-variant">Providing these now will fast-track your application.</p>
        </div>
        
        <div className="space-y-6">
          <FileUploadZone 
            label="Current Aged Debtor Report" 
            description="A breakdown of what your customers owe you, sorted by age."
            onFilesSelected={(files) => console.log('Aged Debtors:', files)}
          />
          <FileUploadZone 
            label="Current Aged Creditor Report" 
            description="A breakdown of what you owe to suppliers, sorted by age."
            onFilesSelected={(files) => console.log('Aged Creditors:', files)}
          />
          <FileUploadZone 
            label="Last 3 Months Business Bank Statements" 
            description="PDF format preferred. Please provide the main trading account."
            onFilesSelected={(files) => console.log('Bank Statements:', files)}
          />
          {data.business?.industry === 'construction' && (
            <FileUploadZone 
              label="Sample application for payment or certified valuation (construction only)" 
              description="Please provide a recent example."
              onFilesSelected={(files) => console.log('Construction Sample:', files)}
            />
          )}
        </div>

        <div className="mt-8 flex justify-center border-t border-outline-variant pt-8">
          <button
            onClick={handleCompleteUploads}
            className="px-8 py-4 bg-primary text-on-primary label-m rounded-full hover:bg-primary/90 transition-colors shadow-sm min-h-touch focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
      <p className="body-l text-on-surface-variant mb-10">
        We have received your details. To fast-track your assessment, our lenders will need to see some standard financial reports.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
        <button 
          onClick={() => setChoice('now')}
          className="flex flex-col items-center justify-center p-8 border-2 border-primary rounded-2xl hover:bg-surface-container transition-colors group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-h-touch"
        >
          <UploadCloud className="w-12 h-12 text-primary mb-4 group-hover:-translate-y-1 transition-transform" />
          <h3 className="title-m text-on-surface mb-2">Upload them now</h3>
          <p className="body-l text-on-surface-variant">I have my reports ready (takes 2 mins)</p>
        </button>

        <button 
          onClick={() => { setChoice('later'); handleDefer(); }}
          disabled={isSendingLink}
          className="flex flex-col items-center justify-center p-8 border-2 border-outline rounded-2xl hover:bg-surface-container transition-colors group disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-h-touch"
        >
          {linkSent ? (
            <CheckCircle2 className="w-12 h-12 text-primary mb-4" />
          ) : (
            <Clock className="w-12 h-12 text-on-surface-variant mb-4 group-hover:-translate-y-1 transition-transform" />
          )}
          <h3 className="title-m text-on-surface mb-2">{linkSent ? 'Link sent!' : "I'll provide them later"}</h3>
          <p className="body-l text-on-surface-variant">Send me a secure link to upload them another time</p>
        </button>
      </div>
    </div>
  );
};
