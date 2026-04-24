import { createFileRoute } from '@tanstack/react-router';
import Activity from '../../pages/Activity';

export const Route = createFileRoute('/_auth/activity')({
  component: Activity,
});
