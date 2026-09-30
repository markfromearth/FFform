import React, { useRef, useState, useEffect } from 'react';
import { Button } from './Button';
import { Pen, Type, RotateCcw, Check, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { SignatureEntry } from '../../types/application';

interface SignatureInputProps {
  principalId: string;
  principalName: string;
  title?: string;
  existingSignature?: SignatureEntry;
  onSaveSignature: (sig: SignatureEntry) => void;
  error?: string;
}

export const SignatureInput: React.FC<SignatureInputProps> = ({
  principalId,
  principalName,
  title = 'Signature',
  existingSignature,
  onSaveSignature,
  error,
}) => {
  const [tab, setTab] = useState<'draw' | 'type'>(existingSignature?.signatureType || 'draw');
  const [typedName, setTypedName] = useState<string>(
    existingSignature?.signatureType === 'type' ? existingSignature.signatureData : principalName || ''
  );
  const [isSigned, setIsSigned] = useState<boolean>(!!existingSignature?.signatureData);
  const [hasCanvasDrawn, setHasCanvasDrawn] = useState<boolean>(
    existingSignature?.signatureType === 'draw' && !!existingSignature?.signatureData
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef<boolean>(false);

  // Initialize canvas with existing data or clear background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on CSS display size for crisp lines
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = 140 * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (existingSignature?.signatureType === 'draw' && existingSignature.signatureData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, 140);
      };
      img.src = existingSignature.signatureData;
    }
  }, [existingSignature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasCanvasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    setIsSigned(true);
    onSaveSignature({
      principalId,
      principalName,
      signatureType: 'draw',
      signatureData: dataUrl,
      signedAt: new Date().toISOString(),
    });
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasCanvasDrawn(false);
    setIsSigned(false);
  };

  const handleTypedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTypedName(val);
    if (val.trim().length > 1) {
      setIsSigned(true);
      onSaveSignature({
        principalId,
        principalName,
        signatureType: 'type',
        signatureData: val.trim(),
        signedAt: new Date().toISOString(),
      });
    } else {
      setIsSigned(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/10 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-white/70">
            Signatory: <strong className="text-white">{principalName || 'Owner / Principal'}</strong>
          </p>
        </div>

        {/* Tab switcher: Draw vs Type */}
        <div role="tablist" aria-label="Signature method" className="flex rounded-lg bg-slate-100 p-0.5 border border-white/10">
          <button
            type="button"
            role="tab"
            id={`tab-draw-${principalId}`}
            aria-selected={tab === 'draw'}
            aria-controls={`panel-draw-${principalId}`}
            onClick={() => setTab('draw')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              tab === 'draw' ? 'bg-white/10 text-brand-700 shadow-xs' : 'text-white/80 hover:text-white'
            )}
          >
            <Pen className="w-3.5 h-3.5" />
            <span>Draw</span>
          </button>
          <button
            type="button"
            role="tab"
            id={`tab-type-${principalId}`}
            aria-selected={tab === 'type'}
            aria-controls={`panel-type-${principalId}`}
            onClick={() => setTab('type')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              tab === 'type' ? 'bg-white/10 text-brand-700 shadow-xs' : 'text-white/80 hover:text-white'
            )}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Type</span>
          </button>
        </div>
      </div>

      <div className="mt-4">
        {tab === 'draw' ? (
          <div
            id={`panel-draw-${principalId}`}
            role="tabpanel"
            aria-labelledby={`tab-draw-${principalId}`}
          >
            <div className="relative rounded-lg border-2 border-dashed border-white/20 bg-slate-50/70 p-1 hover:border-slate-400 transition-colors">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label="Digital signature drawing pad. Switch to the Type tab if you prefer typing your signature using a keyboard."
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-32 block touch-none cursor-crosshair bg-transparent"
              />
              {!hasCanvasDrawn && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-xs text-white/70 select-none">
                  <Pen className="w-5 h-5 mb-1 text-white/60" />
                  <span>Use mouse or finger to draw your signature here</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-white/70 font-medium">
                Timestamp: {existingSignature?.signedAt ? new Date(existingSignature.signedAt).toLocaleString() : 'Ready to sign'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                leftIcon={<RotateCcw className="w-3.5 h-3.5 text-white/70" />}
                className="text-xs text-white/80 hover:text-white"
              >
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div
            id={`panel-type-${principalId}`}
            role="tabpanel"
            aria-labelledby={`tab-type-${principalId}`}
            className="space-y-3"
          >
            <div>
              <label htmlFor={`typed_sig_${principalId}`} className="text-xs font-medium text-white/90 block mb-1">
                Type your full legal name:
              </label>
              <input
                id={`typed_sig_${principalId}`}
                name={`signature_name_${principalId}`}
                type="text"
                autoComplete="name"
                value={typedName}
                onChange={handleTypedChange}
                placeholder="e.g. Alistair Ross"
                className="w-full px-3 py-2 text-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
            </div>

            {typedName.trim() && (
              <div className="p-3 bg-slate-50 rounded-lg border border-white/10">
                <span className="text-[11px] text-white/70 uppercase tracking-wider block mb-1">Digital Signature Preview:</span>
                <p className="font-serif italic text-2xl text-white tracking-wider">
                  {typedName}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Signature disclaimer badge */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-white/70">
        <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <p className="leading-snug">
            <strong>Electronic Signature Notice:</strong> By providing your signature above, you confirm you are authorized to sign and that this electronic submission holds the same legal standing as a handwritten signature.
          </p>
          <span className="text-[10px] text-white/60 italic block mt-0.5">
            [Interactive Prototype e-signature component — Ready for DocuSign / Adobe Sign API bridge]
          </span>
        </div>
      </div>

      {error && (
        <p className="text-xs font-medium text-rose-600 mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
