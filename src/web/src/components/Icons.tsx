// Shared SVG Icon Components
// All icons accept an optional aria-hidden prop for accessibility
interface IconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export const GamepadIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden={ariaHidden}>
    {/* Controller body */}
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 11h2M7 10v2" />
    <circle cx="16" cy="10" r="0.75" fill="currentColor" />
    <circle cx="18" cy="12" r="0.75" fill="currentColor" />
    <circle cx="16" cy="14" r="0.75" fill="currentColor" />
    <circle cx="14" cy="12" r="0.75" fill="currentColor" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.5 5.5h-11a4 4 0 00-4 4v5a4 4 0 004 4h11a4 4 0 004-4v-5a4 4 0 00-4-4z" />
  </svg>
);

export const CloseIcon = ({ className = "w-6 h-6", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const SeedersIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

export const EyeIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export const EyeSlashIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

export const PencilIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

export const TrashIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const MagnifyingGlassIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export const PlayIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const PauseIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const RefreshIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export const DownloadIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

export const FolderIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
  </svg>
);

export const ChevronLeftIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

export const StarIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export const FolderOpenIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
  </svg>
);

export const ExternalLinkIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

export const ClockIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const LinuxIcon = ({ className = "w-4 h-4", 'aria-hidden': ariaHidden }: IconProps) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
    <path d="M12.504 0c-.155 0-.311.001-.465.003-.653.014-1.27.11-1.85.297-.461.152-.962.418-1.316.75-.44.413-.757.96-.992 1.59-.235.63-.378 1.334-.452 2.1-.037.38-.059.774-.059 1.18 0 .76.104 1.61.391 2.357.287.747.776 1.387 1.47 1.809.39.237.827.389 1.285.472v.09c-.015.04-.027.082-.04.124-.141.42-.326.934-.468 1.308-.155.409-.28.758-.347 1.012-.063.237-.09.417-.09.545 0 .244.087.482.257.67.17.189.405.302.658.347.253.045.528.045.782.045.253 0 .529 0 .782-.045.253-.045.488-.158.658-.347.17-.188.257-.426.257-.67 0-.128-.027-.308-.09-.545-.067-.254-.192-.603-.347-1.012-.142-.374-.327-.888-.468-1.308a3.4 3.4 0 01-.04-.124v-.09c.458-.083.895-.235 1.285-.472.694-.422 1.183-1.062 1.47-1.809.287-.747.391-1.597.391-2.357 0-.406-.022-.8-.059-1.18-.074-.766-.217-1.47-.452-2.1-.235-.63-.552-1.177-.992-1.59-.354-.332-.855-.598-1.316-.75-.58-.187-1.197-.283-1.85-.297A36.8 36.8 0 0012.504 0zm-.166 1.512c.115 0 .232.001.349.003.51.011.978.085 1.392.219.313.104.597.27.808.474.266.259.476.619.639 1.058.163.439.276 1.003.334 1.648.028.311.045.637.045.98 0 .63-.085 1.334-.306 1.908-.22.574-.592 1.013-1.092 1.318-.252.154-.53.262-.823.326v.287c.14.33.347.83.507 1.253.137.359.244.659.297.85.039.138.047.215.047.25 0 .007-.002.014-.008.022-.006.008-.017.017-.036.024-.04.013-.113.02-.2.02s-.16-.007-.2-.02c-.019-.007-.03-.016-.036-.024-.006-.008-.008-.015-.008-.022 0-.035.008-.112.047-.25.053-.191.16-.491.297-.85.16-.423.367-.923.507-1.253v-.287a2.81 2.81 0 01-.823-.326c-.5-.305-.872-.744-1.092-1.318-.221-.574-.306-1.278-.306-1.908 0-.343.017-.669.045-.98.058-.645.171-1.21.334-1.648.163-.439.373-.8.639-1.058.211-.204.495-.37.808-.474.414-.134.882-.208 1.392-.219.117-.002.234-.003.349-.003z"/>
  </svg>
);
