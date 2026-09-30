import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="flex justify-between items-center px-6 py-4 bg-surface text-on-surface border-b border-outline">
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
