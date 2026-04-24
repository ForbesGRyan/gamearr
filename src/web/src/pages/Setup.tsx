import { useState } from 'react';
import { useNavigate } from '../router/compat';
import { useSkipSetup } from '../queries/system';
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

interface StepContentProps {
  currentStep: Step;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
  onSkipSetup: () => void;
  error: string | null;
  setError: (error: string | null) => void;
  testStatus: TestStatus;
  setTestStatus: (status: TestStatus) => void;
  libraryName: string;
  setLibraryName: (name: string) => void;
  libraryPath: string;
  setLibraryPath: (path: string) => void;
  igdbClientId: string;
  setIgdbClientId: (id: string) => void;
  igdbClientSecret: string;
  setIgdbClientSecret: (secret: string) => void;
  prowlarrUrl: string;
  setProwlarrUrl: (url: string) => void;
  prowlarrApiKey: string;
  setProwlarrApiKey: (key: string) => void;
  qbHost: string;
  setQbHost: (host: string) => void;
  qbUsername: string;
  setQbUsername: (username: string) => void;
  qbPassword: string;
  setQbPassword: (password: string) => void;
}

function StepContent({
  currentStep,
  onNext,
  onBack,
  onFinish,
  onSkipSetup,
  error,
  setError,
  testStatus,
  setTestStatus,
  libraryName,
  setLibraryName,
  libraryPath,
  setLibraryPath,
  igdbClientId,
  setIgdbClientId,
  igdbClientSecret,
  setIgdbClientSecret,
  prowlarrUrl,
  setProwlarrUrl,
  prowlarrApiKey,
  setProwlarrApiKey,
  qbHost,
  setQbHost,
  qbUsername,
  setQbUsername,
  qbPassword,
  setQbPassword,
}: StepContentProps) {
  switch (currentStep) {
    case 'welcome':
      return (
        <WelcomeStep
          onNext={onNext}
          onSkipSetup={onSkipSetup}
        />
      );

    case 'library':
      return (
        <LibraryStep
          onNext={onNext}
          onBack={onBack}
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
          onNext={onNext}
          onBack={onBack}
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
          onNext={onNext}
          onBack={onBack}
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
          onNext={onNext}
          onBack={onBack}
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
      return <CompleteStep onFinish={onFinish} />;

    default:
      return null;
  }
}

export function Setup() {
  const navigate = useNavigate();
  const skipSetupMutation = useSkipSetup();
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

  const finishOrSkip = async () => {
    try {
      await skipSetupMutation.mutateAsync();
    } catch (e) {
      // Navigate anyway — the local intent is "I'm done with setup",
      // server-side persistence failure shouldn't trap the user here.
      console.error('Failed to mark setup complete:', e);
    }
    navigate('/');
  };

  const showProgressBar = currentStep !== 'welcome' && currentStep !== 'complete';

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Progress bar */}
      {showProgressBar && <SetupProgressBar currentStep={currentStep} />}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <StepContent
          currentStep={currentStep}
          onNext={goNext}
          onBack={goBack}
          onFinish={finishOrSkip}
          onSkipSetup={finishOrSkip}
          error={error}
          setError={setError}
          testStatus={testStatus}
          setTestStatus={setTestStatus}
          libraryName={libraryName}
          setLibraryName={setLibraryName}
          libraryPath={libraryPath}
          setLibraryPath={setLibraryPath}
          igdbClientId={igdbClientId}
          setIgdbClientId={setIgdbClientId}
          igdbClientSecret={igdbClientSecret}
          setIgdbClientSecret={setIgdbClientSecret}
          prowlarrUrl={prowlarrUrl}
          setProwlarrUrl={setProwlarrUrl}
          prowlarrApiKey={prowlarrApiKey}
          setProwlarrApiKey={setProwlarrApiKey}
          qbHost={qbHost}
          setQbHost={setQbHost}
          qbUsername={qbUsername}
          setQbUsername={setQbUsername}
          qbPassword={qbPassword}
          setQbPassword={setQbPassword}
        />
      </div>
    </div>
  );
}
