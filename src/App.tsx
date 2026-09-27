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
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 selection:bg-brand-100 selection:text-brand-900">
      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:brand-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Persistent application header */}
      <Header />

      {/* Main question journey area */}
      <main id="main-content" className="flex-1 w-full py-8" tabIndex={-1}>
        <JourneyRouter />
      </main>

      {/* Persistent footer */}
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
