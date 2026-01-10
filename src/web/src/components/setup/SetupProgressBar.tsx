import { Step, STEPS } from './types';

interface SetupProgressBarProps {
  currentStep: Step;
}

export default function SetupProgressBar({ currentStep }: SetupProgressBarProps) {
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const middleSteps = STEPS.filter(s => s.id !== 'welcome' && s.id !== 'complete');

  return (
    <div className="bg-gray-800 px-6 py-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          {middleSteps.map((step, index) => {
            const stepIndex = STEPS.findIndex(s => s.id === step.id);
            const isActive = currentStepIndex >= stepIndex;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isActive ? 'bg-blue-600' : 'bg-gray-700'
                  } ${isCurrent ? 'ring-2 ring-blue-400' : ''}`}
                >
                  {index + 1}
                </div>
                {index < middleSteps.length - 1 && (
                  <div
                    className={`w-16 sm:w-24 h-1 mx-2 ${
                      currentStepIndex > stepIndex ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Library</span>
          <span>IGDB</span>
          <span>Prowlarr</span>
          <span>qBittorrent</span>
        </div>
      </div>
    </div>
  );
}
