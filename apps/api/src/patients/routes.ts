import {
  appointmentSchema,
  bookAppointmentSchema,
  callRecordSchema,
  createPatientSchema,
  listPatientsQuerySchema,
  patientIdSchema,
  patientSchema,
  updatePatientSchema,
} from '@voice-intake/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppointmentService } from '../appointments/service';
import type { CallRepository } from '../calls/repository';
import { ok, responseSchemas } from '../http/envelope';
import type { PatientService } from './service';

interface PatientRoutesOptions {
  patients: PatientService;
  calls: CallRepository;
  appointments: AppointmentService;
}

const patientParams = z.object({ id: patientIdSchema });

export const patientRoutes: FastifyPluginAsyncZod<PatientRoutesOptions> = async (
  app,
  { patients, calls, appointments },
) => {
  app.get(
    '/patients',
    {
      schema: {
        tags: ['patients'],
        summary: 'List patients, optionally filtered',
        querystring: listPatientsQuerySchema,
        response: responseSchemas(200, z.array(patientSchema)),
      },
    },
    async (request) => ok(await patients.list(request.query)),
  );

  app.get(
    '/patients/:id',
    {
      schema: {
        tags: ['patients'],
        summary: 'Get a patient by ID',
        params: patientParams,
        response: responseSchemas(200, patientSchema),
      },
    },
    async (request) => ok(await patients.get(request.params.id)),
  );

  app.post(
    '/patients',
    {
      schema: {
        tags: ['patients'],
        summary: 'Register a new patient',
        body: createPatientSchema,
        response: responseSchemas(201, patientSchema),
      },
    },
    async (request, reply) => reply.status(201).send(ok(await patients.create(request.body))),
  );

  app.put(
    '/patients/:id',
    {
      schema: {
        tags: ['patients'],
        summary: 'Update a patient (partial updates allowed)',
        params: patientParams,
        body: updatePatientSchema,
        response: responseSchemas(200, patientSchema),
      },
    },
    async (request) => ok(await patients.update(request.params.id, request.body)),
  );

  app.delete(
    '/patients/:id',
    {
      schema: {
        tags: ['patients'],
        summary: 'Soft-delete a patient',
        params: patientParams,
        response: responseSchemas(200, patientSchema),
      },
    },
    async (request) => ok(await patients.remove(request.params.id)),
  );

  app.get(
    '/patients/:id/calls',
    {
      schema: {
        tags: ['patients'],
        summary: 'List voice calls linked to a patient',
        params: patientParams,
        response: responseSchemas(200, z.array(callRecordSchema)),
      },
    },
    async (request) => {
      await patients.get(request.params.id);
      return ok(await calls.listByPatient(request.params.id));
    },
  );

  app.get(
    '/patients/:id/appointments',
    {
      schema: {
        tags: ['patients'],
        summary: 'List appointments booked for a patient',
        params: patientParams,
        response: responseSchemas(200, z.array(appointmentSchema)),
      },
    },
    async (request) => {
      await patients.get(request.params.id);
      return ok(await appointments.listByPatient(request.params.id));
    },
  );

  app.post(
    '/patients/:id/appointments',
    {
      schema: {
        tags: ['patients'],
        summary: 'Book an appointment for a patient',
        params: patientParams,
        body: bookAppointmentSchema,
        response: responseSchemas(201, appointmentSchema),
      },
    },
    async (request, reply) => {
      await patients.get(request.params.id);
      const appointment = await appointments.book(request.params.id, request.body);
      return reply.status(201).send(ok(appointment));
    },
  );
};
