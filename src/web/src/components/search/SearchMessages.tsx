interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="mb-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200">
      {message}
    </div>
  );
}

interface SuccessMessageProps {
  message: string;
}

export function SuccessMessage({ message }: SuccessMessageProps) {
  return (
    <div className="mb-6 p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded text-green-200">
      {message}
    </div>
  );
}
