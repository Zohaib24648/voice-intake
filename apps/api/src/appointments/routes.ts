import { appointmentSlotSchema } from '@voice-intake/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok, responseSchemas } from '../http/envelope';
import type { AppointmentService } from './service';

interface AppointmentRoutesOptions {
  appointments: AppointmentService;
}

export const appointmentRoutes: FastifyPluginAsyncZod<AppointmentRoutesOptions> = async (
  app,
  { appointments },
) => {
  app.get(
    '/appointments/slots',
    {
      schema: {
        tags: ['appointments'],
        summary: 'List upcoming appointment slots that are still open',
        response: responseSchemas(200, z.array(appointmentSlotSchema)),
      },
    },
    async () => ok(await appointments.availableSlots()),
  );
};
