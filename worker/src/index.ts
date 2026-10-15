import { handleRequest } from './handler';

export interface Env {
  ALLOWED_ORIGINS: string;
}

export default {
  fetch(request, env) {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    return handleRequest(request, { allowedOrigins });
  },
} satisfies ExportedHandler<Env>;
