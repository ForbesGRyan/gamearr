export type Step = 'welcome' | 'library' | 'igdb' | 'prowlarr' | 'qbittorrent' | 'complete';

interface StepConfig {
  id: Step;
  title: string;
  description: string;
}

export const STEPS: StepConfig[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started with Gamearr' },
  { id: 'library', title: 'Library', description: 'Where your games are stored' },
  { id: 'igdb', title: 'IGDB', description: 'Game metadata provider' },
  { id: 'prowlarr', title: 'Prowlarr', description: 'Indexer manager' },
  { id: 'qbittorrent', title: 'qBittorrent', description: 'Download client' },
  { id: 'complete', title: 'Complete', description: 'Setup finished' },
];

export type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export interface BaseStepProps {
  onNext: () => void;
  onBack: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}
