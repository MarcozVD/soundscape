import { router } from '../trpc';
import { authRouter } from './auth';
import { tracksRouter } from './tracks';
import { recommendationsRouter } from './recommendations';
import { playlistsRouter } from './playlists';
import { ratingsRouter } from './ratings';
import { commentsRouter } from './comments';
import { searchRouter } from './search';
import { providersRouter } from './providers';
import { adminRouter } from './admin';
import { sharingRouter } from './sharing';

export const appRouter = router({
  auth: authRouter,
  tracks: tracksRouter,
  recommendations: recommendationsRouter,
  playlists: playlistsRouter,
  ratings: ratingsRouter,
  comments: commentsRouter,
  search: searchRouter,
  providers: providersRouter,
  admin: adminRouter,
  sharing: sharingRouter,
});

export type AppRouter = typeof appRouter;
