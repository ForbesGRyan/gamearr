import { createFileRoute } from '@tanstack/react-router';
import GameDetail from '../../pages/GameDetail';

export const Route = createFileRoute('/_auth/game/$platform/$slug')({
  component: GameDetail,
});
