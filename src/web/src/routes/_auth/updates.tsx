import { createFileRoute } from '@tanstack/react-router';
import Updates from '../../pages/Updates';

export const Route = createFileRoute('/_auth/updates')({
  component: Updates,
});
