import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="flex justify-between items-center px-6 py-4 bg-surface-container-lowest text-white border-b border-outline-variant shadow-sm">
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
