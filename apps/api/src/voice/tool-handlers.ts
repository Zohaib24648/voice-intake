import {
  bookAppointmentSchema,
  createPatientSchema,
  normalizeUsPhoneNumber,
  patientIdSchema,
  updatePatientSchema,
  type Patient,
} from '@voice-intake/shared';
import { z } from 'zod';
import type { AppointmentService } from '../appointments/service';
import { describeSlot } from '../appointments/service';
import type { CallRepository } from '../calls/repository';
import { AppError, NotFoundError } from '../http/errors';
import type { Logger } from '../logger';
import type { PatientService } from '../patients/service';
import { fieldErrorsFromIssues } from '../validation';
import { TOOL_NAMES, type ToolName } from './tools';

export interface ToolCallContext {
  callId: string | undefined;
  callerPhoneNumber: string | undefined;
}

export type ToolResult = Record<string, unknown>;
export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolCallContext,
) => Promise<ToolResult>;

interface ToolHandlerDependencies {
  patients: PatientService;
  calls: CallRepository;
  appointments: AppointmentService;
  logger: Logger;
}

const lookupArgsSchema = z.object({
  phone_number: z.string().transform((value, ctx) => {
    const normalized = normalizeUsPhoneNumber(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'Phone number must be a valid 10-digit U.S. phone number',
      });
      return z.NEVER;
    }
    return normalized;
  }),
});

const updateArgsSchema = z.object({
  patient_id: patientIdSchema,
  changes: updatePatientSchema,
});

const bookArgsSchema = z.object({
  patient_id: patientIdSchema,
  ...bookAppointmentSchema.shape,
});

export function createToolHandlers({
  patients,
  calls,
  appointments,
  logger,
}: ToolHandlerDependencies): Record<ToolName, ToolHandler> {
  const linkCallToPatient = async (context: ToolCallContext, patientId: string) => {
    if (!context.callId) return;
    await calls.linkPatient({
      provider_call_id: context.callId,
      patient_id: patientId,
      caller_phone_number: context.callerPhoneNumber ?? null,
    });
  };

  return {
    [TOOL_NAMES.lookupPatientByPhone]: async (args) => {
      const parsed = lookupArgsSchema.safeParse(args);
      if (!parsed.success) return invalidArguments(parsed.error);

      const patient = await patients.findByPhoneNumber(parsed.data.phone_number);
      return patient ? { found: true, patient: forAgent(patient) } : { found: false };
    },

    [TOOL_NAMES.registerPatient]: async (args, context) => {
      const parsed = createPatientSchema.safeParse(args);
      if (!parsed.success) {
        logger.info(
          { callId: context.callId, issues: parsed.error.issues },
          'Voice registration rejected by validation',
        );
        return invalidArguments(parsed.error);
      }

      const patient = await patients.create(parsed.data);
      await linkCallToPatient(context, patient.patient_id);
      logger.info(
        { event: 'patient.registered', callId: context.callId, patient },
        'Patient registered from voice call',
      );
      return { ok: true, patient_id: patient.patient_id, first_name: patient.first_name };
    },

    [TOOL_NAMES.updatePatient]: async (args, context) => {
      const parsed = updateArgsSchema.safeParse(args);
      if (!parsed.success) return invalidArguments(parsed.error);

      try {
        const patient = await patients.update(parsed.data.patient_id, parsed.data.changes);
        await linkCallToPatient(context, patient.patient_id);
        logger.info(
          { event: 'patient.updated', callId: context.callId, patient },
          'Patient updated from voice call',
        );
        return { ok: true, patient: forAgent(patient) };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return { ok: false, error: 'No active patient record exists with that patient_id' };
        }
        throw error;
      }
    },

    [TOOL_NAMES.getAvailableAppointmentSlots]: async () => ({
      slots: await appointments.availableSlots(),
    }),

    [TOOL_NAMES.bookAppointment]: async (args, context) => {
      const parsed = bookArgsSchema.safeParse(args);
      if (!parsed.success) return invalidArguments(parsed.error);

      const { patient_id, ...booking } = parsed.data;
      try {
        await patients.get(patient_id);
        const appointment = await appointments.book(patient_id, booking);
        logger.info(
          { event: 'appointment.booked', callId: context.callId, appointment },
          'Appointment booked from voice call',
        );
        return {
          ok: true,
          appointment: {
            scheduled_at: appointment.scheduled_at,
            label: describeSlot(new Date(appointment.scheduled_at)),
          },
        };
      } catch (error) {
        if (error instanceof AppError) return { ok: false, error: error.message };
        throw error;
      }
    },
  };
}

function invalidArguments(error: z.ZodError): ToolResult {
  return { ok: false, validation_errors: fieldErrorsFromIssues(error.issues) };
}

function forAgent(patient: Patient) {
  const { created_at, updated_at, deleted_at, ...fields } = patient;
  return fields;
}
