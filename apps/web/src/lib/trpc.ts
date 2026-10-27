import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@soundscape/api-client';

export const trpc = createTRPCReact<AppRouter>();
