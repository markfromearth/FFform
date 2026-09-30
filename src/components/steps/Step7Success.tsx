import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const Step7Success: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 text-center py-12">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
      </div>
      <h1 className="display-s text-on-surface mb-4">You're all set!</h1>
      <p className="body-l text-white/80 mb-8">
        Your enquiry and documents have been successfully received. A Factoring Finance specialist will review your profile and contact you shortly to discuss the best available lender options.
      </p>
      <div className="label-m text-white/80">
        You can now safely close this window.
      </div>
    </div>
  );
};
