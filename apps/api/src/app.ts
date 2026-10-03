import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { AppointmentRepository } from './appointments/repository';
import { appointmentRoutes } from './appointments/routes';
import { AppointmentService } from './appointments/service';
import { CallRepository } from './calls/repository';
import type { Database } from './db/client';
import { healthRoutes } from './health/routes';
import { errorHandling } from './http/error-handler';
import type { Logger } from './logger';
import { PatientRepository } from './patients/repository';
import { patientRoutes } from './patients/routes';
import { PatientService } from './patients/service';
import { createToolHandlers } from './voice/tool-handlers';
import { retellWebhookRoutes } from './voice/webhook';

export interface AppOptions {
  db: Database;
  logger: Logger;
  retellApiKey: string;
}

export type App = Awaited<ReturnType<typeof buildApp>>;

export async function buildApp({ db, logger, retellApiKey }: AppOptions) {
  const app = Fastify({ loggerInstance: logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorHandling);

  const patients = new PatientService(new PatientRepository(db));
  const calls = new CallRepository(db);
  const appointments = new AppointmentService(new AppointmentRepository(db));

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Patient Registration API',
        description:
          'Patient demographics collected by the voice agent and exposed over REST. Responses use the envelope { data, error }.',
        version: '1.0.0',
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(healthRoutes, { db });
  await app.register(patientRoutes, { patients, calls, appointments });
  await app.register(appointmentRoutes, { appointments });
  await app.register(retellWebhookRoutes, {
    apiKey: retellApiKey,
    tools: createToolHandlers({ patients, calls, appointments, logger }),
    calls,
  });

  return app;
}
