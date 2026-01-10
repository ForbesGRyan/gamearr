interface CompleteStepProps {
  onFinish: () => void;
}

export default function CompleteStep({ onFinish }: CompleteStepProps) {
  return (
    <div className="text-center">
      <div className="text-6xl mb-6">🎉</div>
      <h2 className="text-3xl font-bold mb-4">You're All Set!</h2>
      <p className="text-gray-400 mb-8 max-w-md mx-auto">
        Gamearr is configured and ready to use. Start by adding games to your library
        or import existing games from your folders.
      </p>
      <button
        onClick={onFinish}
        className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-medium text-lg transition"
      >
        Start Using Gamearr
      </button>
    </div>
  );
}
