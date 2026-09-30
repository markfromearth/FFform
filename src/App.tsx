import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ApplicationProvider, useApplication } from './context/ApplicationContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';

// Step components
import { Step1YourBusiness } from './components/steps/Step1YourBusiness';
import { Step2YourDetails } from './components/steps/Step2YourDetails';
import { Step3YourInvoices } from './components/steps/Step3YourInvoices';
import { Step4FinalDetails } from './components/steps/Step4FinalDetails';
import { Step5Review } from './components/steps/Step5Review';
import { Step6Uploads } from './components/steps/Step6Uploads';
import { Step7Success } from './components/steps/Step7Success';

const JourneyRouter: React.FC = () => {
  const { currentStep } = useApplication();

  switch (currentStep) {
    case 0:
      return <Step1YourBusiness />;
    case 1:
      return <Step2YourDetails />;
    case 2:
      return <Step3YourInvoices />;
    case 3:
      return <Step4FinalDetails />;
    case 4:
      return <Step5Review />;
    case 5:
      return <Step6Uploads />;
    case 6:
      return <Step7Success />;
    default:
      return <Step1YourBusiness />;
  }
};

const AppContent: React.FC = () => {
  const { currentStep, setTurnstileToken } = useApplication();
  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      document.getElementById('main-content')?.focus();
    }
  }, [currentStep]);

  const labels = ['Your business', 'Your details', 'Your invoices', 'Final details', 'Review', 'Uploads', 'Complete'];
  const isComplete = currentStep >= 6;
  const isSubmitted = currentStep >= 5;
  const percent = isComplete ? 100 : ((currentStep + 1) / 5) * 100;
  
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 selection:bg-brand-100 selection:text-brand-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <Header />

      <main id="main-content" className="flex-1 w-full py-8 flex justify-center px-4 sm:px-6" tabIndex={-1}>
        <section className="w-full max-w-[760px] bg-surface rounded-[18px] border border-outline-variant shadow-elevation-3 overflow-hidden flex flex-col">
          
          {/* Progress Bar (omitted on complete) */}
          {!isComplete && (
            <div className="px-7 pt-5">
              <div className="flex items-center justify-between gap-4 text-label-m text-on-surface-variant mb-2.5">
                <span>
                  {isSubmitted ? labels[currentStep] : `Step ${currentStep + 1} of 5 · ${labels[currentStep]}`}
                </span>
                {!isSubmitted && <span>About 3 minutes</span>}
              </div>
              <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden" role="progressbar" aria-label="Application progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="h-full bg-accent rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
            </div>
          )}

          <div className="p-7">
            <JourneyRouter />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <ApplicationProvider>
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </ApplicationProvider>
  );
}
