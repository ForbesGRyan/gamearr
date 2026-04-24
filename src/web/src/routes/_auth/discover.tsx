import { createFileRoute } from '@tanstack/react-router';
import Discover from '../../pages/Discover';

export const Route = createFileRoute('/_auth/discover')({
  component: Discover,
});
