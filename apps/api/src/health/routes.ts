import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Database } from '../db/client';
import { ok, responseSchemas } from '../http/envelope';
import { ServiceUnavailableError } from '../http/errors';

interface HealthRoutesOptions {
  db: Database;
}

const healthSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('ok'),
  uptime_seconds: z.number(),
});

const serviceDescriptionSchema = z.object({
  name: z.string(),
  docs: z.string(),
  health: z.string(),
  patients: z.string(),
});

export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (app, { db }) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['system'],
        summary: 'Service description and entry points',
        response: responseSchemas(200, serviceDescriptionSchema),
      },
    },
    async () =>
      ok({
        name: 'Patient Registration API',
        docs: '/docs',
        health: '/health',
        patients: '/patients',
      }),
  );

  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness and database connectivity check',
        response: responseSchemas(200, healthSchema),
      },
    },
    async (request) => {
      try {
        await db.execute(sql`select 1`);
      } catch (error) {
        request.log.error({ err: error }, 'Database health check failed');
        throw new ServiceUnavailableError('Database is unreachable');
      }

      return ok({
        status: 'ok' as const,
        database: 'ok' as const,
        uptime_seconds: Math.round(process.uptime()),
      });
    },
  );
};
