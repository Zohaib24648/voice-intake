import { fileURLToPath } from 'node:url';

// Resolved relative to this file so it works from both src/ (tsx) and dist/ (bundled).
export const MIGRATIONS_DIR = fileURLToPath(new URL('../drizzle', import.meta.url));
