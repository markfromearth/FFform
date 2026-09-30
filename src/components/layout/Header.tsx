import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="flex justify-between items-center px-6 py-4 bg-white text-slate-900 border-b border-slate-200 shadow-sm">
      <div className="flex items-center">
        <img 
          src="/factoring-finance-logo.png" 
          alt="Factoring Finance" 
          className="h-10 w-auto" 
        />
      </div>
    </header>
  );
};
