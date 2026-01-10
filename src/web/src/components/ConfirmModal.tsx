interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'info',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: (
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          confirmButton: 'bg-red-600 hover:bg-red-700',
          iconBg: 'bg-red-900/50',
        };
      case 'warning':
        return {
          icon: (
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          confirmButton: 'bg-yellow-600 hover:bg-yellow-700',
          iconBg: 'bg-yellow-900/50',
        };
      case 'info':
      default:
        return {
          icon: (
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          confirmButton: 'bg-blue-600 hover:bg-blue-700',
          iconBg: 'bg-blue-900/50',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      <div className="fixed inset-0 md:inset-auto md:relative md:max-w-md w-full h-full md:w-auto md:h-auto bg-gray-900 md:rounded-lg flex flex-col shadow-2xl border-0 md:border border-gray-600">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-gray-700 flex items-center gap-4 p-4 md:p-6 border-b border-gray-600 md:rounded-t-lg flex-shrink-0 z-10">
          <div className={`p-2 rounded-full ${styles.iconBg}`} aria-hidden="true">
            {styles.icon}
          </div>
          <h2 id="confirm-modal-title" className="text-xl font-bold text-white">{title}</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <p id="confirm-modal-description" className="text-gray-300 whitespace-pre-line">{message}</p>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-gray-800 flex flex-col-reverse md:flex-row justify-end gap-3 p-4 md:p-6 border-t border-gray-700 flex-shrink-0">
          {cancelText && (
            <button
              onClick={onCancel}
              className="px-4 py-2 min-h-[44px] rounded transition text-white bg-gray-600 hover:bg-gray-500 w-full md:w-auto"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 min-h-[44px] rounded transition text-white w-full md:w-auto ${styles.confirmButton}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
