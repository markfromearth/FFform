import React from 'react';
import { ShieldCheck, Lock, CheckCircle2, Heart } from 'lucide-react';
import memDigitalLogo from '../../assets/mem-digital-logo.png';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto bg-transparent border-t border-outline text-white py-6 px-4 sm:px-6 no-print">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center md:text-left body-l text-on-surface-variant">
          <a href="#" className="hover:text-primary transition-colors min-h-touch flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary" aria-label="Privacy Policy">Privacy Policy</a>
          <span className="hidden sm:inline text-outline-variant">•</span>
          <a href="#" className="hover:text-primary transition-colors min-h-touch flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary" aria-label="Accessibility">Accessibility</a>
        </div>
        
        <div className="flex items-center gap-2 label-m text-on-surface-variant">
          <span>© {new Date().getFullYear()} Factoring Finance Ltd</span>
        </div>
      </div>
    </footer>
  );
};
