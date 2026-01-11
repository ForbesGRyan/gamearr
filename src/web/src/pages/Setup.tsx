import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  WelcomeStep,
  LibraryStep,
  IGDBStep,
  ProwlarrStep,
  QBittorrentStep,
  CompleteStep,
  SetupProgressBar,
  STEPS,
} from '../components/setup';
import type { Step, TestStatus } from '../components/setup';

export function Setup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');

  // Form state
  const [libraryName, setLibraryName] = useState('Main Library');
  const [libraryPath, setLibraryPath] = useState('');
  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  const [prowlarrUrl, setProwlarrUrl] = useState('http://localhost:9696');
  const [prowlarrApiKey, setProwlarrApiKey] = useState('');
  const [qbHost, setQbHost] = useState('http://localhost:8080');
  const [qbUsername, setQbUsername] = useState('');
  const [qbPassword, setQbPassword] = useState('');

  // NOTE: Redirect logic for completed setup is handled by SetupGuard in App.tsx
  // The Setup component never redirects on its own - it always shows the wizard

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
      setError(null);
      setTestStatus('idle');
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
      setError(null);
      setTestStatus('idle');
    }
  };

  const handleFinish = async () => {
    try {
      await api.skipSetup();
    } catch (e) {
      // Navigate anyway - setup complete is the important action
      console.error('Failed to mark setup complete:', e);
    }
    navigate('/');
  };

  const handleSkipSetup = async () => {
    try {
      await api.skipSetup();
    } catch (e) {
      // Navigate anyway - user wants to skip
      console.error('Failed to skip setup:', e);
    }
    navigate('/');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <WelcomeStep
            onNext={goNext}
            onSkipSetup={handleSkipSetup}
          />
        );

      case 'library':
        return (
          <LibraryStep
            onNext={goNext}
            onBack={goBack}
            error={error}
            setError={setError}
            libraryName={libraryName}
            setLibraryName={setLibraryName}
            libraryPath={libraryPath}
            setLibraryPath={setLibraryPath}
          />
        );

      case 'igdb':
        return (
          <IGDBStep
            onNext={goNext}
            onBack={goBack}
            error={error}
            setError={setError}
            clientId={igdbClientId}
            setClientId={setIgdbClientId}
            clientSecret={igdbClientSecret}
            setClientSecret={setIgdbClientSecret}
          />
        );

      case 'prowlarr':
        return (
          <ProwlarrStep
            onNext={goNext}
            onBack={goBack}
            error={error}
            setError={setError}
            url={prowlarrUrl}
            setUrl={setProwlarrUrl}
            apiKey={prowlarrApiKey}
            setApiKey={setProwlarrApiKey}
            testStatus={testStatus}
            setTestStatus={setTestStatus}
          />
        );

      case 'qbittorrent':
        return (
          <QBittorrentStep
            onNext={goNext}
            onBack={goBack}
            error={error}
            setError={setError}
            host={qbHost}
            setHost={setQbHost}
            username={qbUsername}
            setUsername={setQbUsername}
            password={qbPassword}
            setPassword={setQbPassword}
            testStatus={testStatus}
            setTestStatus={setTestStatus}
          />
        );

      case 'complete':
        return <CompleteStep onFinish={handleFinish} />;

      default:
        return null;
    }
  };

  const showProgressBar = currentStep !== 'welcome' && currentStep !== 'complete';

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Progress bar */}
      {showProgressBar && <SetupProgressBar currentStep={currentStep} />}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {renderStepContent()}
      </div>
    </div>
  );
}
