import { revalidatePath } from 'next/cache';

// Public pages are cached (revalidate = 60). After an admin edit, mark the
// affected pages stale so the change shows on the next visit instead of up
// to a minute later.
const PATHS = {
  guides: () => {
    revalidatePath('/guides');
    revalidatePath('/guides/[slug]', 'page');
    revalidatePath('/');
  },
  styleRules: () => {
    revalidatePath('/style-mistakes');
  },
  garments: () => {
    revalidatePath('/encyclopedia');
    revalidatePath('/encyclopedia/[slug]', 'page');
    revalidatePath('/colors');
    revalidatePath('/');
  },
  compatibility: () => {
    revalidatePath('/encyclopedia/[slug]', 'page');
    revalidatePath('/');
  },
};

export function revalidatePublicContent(kind: keyof typeof PATHS) {
  try {
    PATHS[kind]();
  } catch (error) {
    // Never fail an admin save because cache invalidation failed; pages
    // still refresh on their normal 60s schedule.
    console.error('revalidatePath failed:', error);
  }
}
