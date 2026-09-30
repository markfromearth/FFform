import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';
export const Button = ({ children, variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, className, disabled, ...props }) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99]';
    const sizeStyles = {
        sm: 'px-3.5 py-2 min-h-[36px] text-xs gap-1.5',
        md: 'px-4 py-2.5 text-sm gap-2',
        lg: 'px-6 py-3.5 text-base gap-2.5',
    };
    const variantStyles = {
        primary: 'bg-brand-700 hover:bg-brand-800 text-white shadow-sm focus-visible:ring-brand-500 border border-transparent font-semibold',
        secondary: 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm focus-visible:ring-slate-700 border border-transparent',
        outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm focus-visible:ring-brand-500',
        ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-400',
        danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus-visible:ring-rose-500 border border-transparent',
    };
    return (<button className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))} disabled={disabled || isLoading} {...props}>
      {isLoading ? (<Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true"/>) : (leftIcon)}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>);
};
