import React from 'react';

interface MobileCardField {
  label: string;
  value: React.ReactNode;
}

interface MobileCardStatus {
  label: string;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
}

interface MobileCardProps {
  title: string;
  subtitle?: string;
  image?: string;
  status?: MobileCardStatus;
  progress?: number;
  fields: MobileCardField[];
  actions?: React.ReactNode;
  onClick?: () => void;
}

const statusColors = {
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function MobileCard({
  title,
  subtitle,
  image,
  status,
  progress,
  fields,
  actions,
  onClick,
}: MobileCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick ? { onClick, type: 'button' as const } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`bg-gray-800 rounded-lg overflow-hidden w-full text-left ${
        onClick ? 'hover:bg-gray-750 active:bg-gray-700 transition cursor-pointer' : ''
      }`}
    >
      <div className="p-4">
        {/* Header with image, title, and status */}
        <div className="flex items-start gap-3 mb-3">
          {image && (
            <img
              src={image}
              alt=""
              className="w-12 h-12 rounded object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white truncate">{title}</h3>
            {subtitle && (
              <p className="text-sm text-gray-400 truncate">{subtitle}</p>
            )}
          </div>
          {status && (
            <span
              className={`px-2 py-1 text-xs font-medium rounded border flex-shrink-0 ${
                statusColors[status.color]
              }`}
            >
              {status.label}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Fields grid */}
        {fields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {fields.map((field, index) => (
              <div key={index} className="flex flex-col">
                <span className="text-gray-500 text-xs">{field.label}</span>
                <span className="text-gray-200 truncate">{field.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {actions && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-700">
            {actions}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

// Utility component for action buttons
interface MobileCardButtonProps {
  onClick: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
  disabled?: boolean;
}

export function MobileCardButton({
  onClick,
  variant = 'secondary',
  children,
  disabled,
}: MobileCardButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400',
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      disabled={disabled}
      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition min-h-[44px] ${
        variantClasses[variant]
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}
