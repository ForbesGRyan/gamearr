interface WelcomeStepProps {
  onNext: () => void;
  onSkipSetup: () => void;
}

export default function WelcomeStep({ onNext, onSkipSetup }: WelcomeStepProps) {
  return (
    <div className="text-center">
      <div className="text-6xl mb-6">🎮</div>
      <h2 className="text-3xl font-bold mb-4">Welcome to Gamearr</h2>
      <p className="text-gray-400 mb-8 max-w-md mx-auto">
        Let's get your game library set up. This wizard will guide you through
        connecting your services.
      </p>
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onNext}
          className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-medium text-lg transition"
        >
          Get Started
        </button>
        <button
          onClick={onSkipSetup}
          className="text-gray-500 hover:text-gray-300 text-sm transition"
        >
          Skip setup, I'll configure later
        </button>
      </div>
    </div>
  );
}
