import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const Modal = ({ isOpen, onClose, title, icon, description, children, footer, maxWidth = 'md', closeOnBackdropClick = true, className, }) => {
    const modalRef = useRef(null);
    const previousActiveElementRef = useRef(null);
    const titleId = useRef(`modal-title-${Math.random().toString(36).substring(2, 9)}`).current;
    const descId = useRef(`modal-desc-${Math.random().toString(36).substring(2, 9)}`).current;
    // Save previous active element when opened and restore on close
    useEffect(() => {
        if (isOpen) {
            previousActiveElementRef.current = document.activeElement;
            // Lock body scroll
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
                if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
                    previousActiveElementRef.current.focus();
                }
            };
        }
    }, [isOpen]);
    // Initial focus into the modal
    useEffect(() => {
        if (isOpen && modalRef.current) {
            // Find the first focusable element inside
            const focusableElements = modalRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
            else {
                modalRef.current.focus();
            }
        }
    }, [isOpen]);
    // Handle Escape key and keyboard focus trapping
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
            return;
        }
        if (e.key === 'Tab' && modalRef.current) {
            const focusableElements = Array.from(modalRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null); // only visible elements
            if (focusableElements.length === 0) {
                e.preventDefault();
                return;
            }
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (e.shiftKey) {
                // Shift + Tab: if on first element, wrap to last
                if (document.activeElement === firstElement || document.activeElement === modalRef.current) {
                    e.preventDefault();
                    lastElement.focus();
                }
            }
            else {
                // Tab: if on last element, wrap to first
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    }, [onClose]);
    if (!isOpen)
        return null;
    const maxWidthStyles = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };
    return (<div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} onKeyDown={handleKeyDown} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" onClick={(e) => {
            if (closeOnBackdropClick && e.target === e.currentTarget) {
                onClose();
            }
        }}>
      <div ref={modalRef} tabIndex={-1} className={twMerge(clsx('relative w-full bg-white rounded-2xl shadow-elevated border border-slate-200 overflow-hidden outline-none', maxWidthStyles[maxWidth], className))}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            {icon}
            <div>
              <h2 id={titleId} className="font-bold text-slate-900 text-base">
                {title}
              </h2>
              {description && (<p id={descId} className="text-xs text-slate-500 mt-0.5">
                  {description}
                </p>)}
            </div>
          </div>

          <button type="button" onClick={onClose} aria-label="Close dialog" className="flex items-center justify-center w-10 h-10 -mr-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none transition-colors">
            <X className="w-5 h-5" aria-hidden="true"/>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">{children}</div>

        {/* Optional Footer */}
        {footer && (<div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            {footer}
          </div>)}
      </div>
    </div>);
};
