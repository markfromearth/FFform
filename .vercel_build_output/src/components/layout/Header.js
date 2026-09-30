import React from 'react';
import { Landmark } from 'lucide-react';
export const Header = () => {
    return (<header className="flex justify-between items-center px-6 py-4 bg-surface text-on-surface border-b border-outline">
      <div className="flex items-center gap-2 title-m">
        <div className="w-8 h-8 rounded-lg bg-primary text-on-primary grid place-items-center">
          <Landmark size={18}/>
        </div>
        <span>Factoring Finance</span>
      </div>
      <div className="label-m text-on-surface-variant">
        Need help? 0151 000 0000
      </div>
    </header>);
};
