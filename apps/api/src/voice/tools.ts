import { SEX_VALUES, US_STATE_CODES } from '@voice-intake/shared';
import type Retell from 'retell-sdk';

export const TOOL_NAMES = {
  lookupPatientByPhone: 'lookup_patient_by_phone',
  registerPatient: 'register_patient',
  updatePatient: 'update_patient',
  getAvailableAppointmentSlots: 'get_available_appointment_slots',
  bookAppointment: 'book_appointment',
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const END_CALL_TOOL_NAME = 'end_call';

type CustomTool = Retell.LlmCreateParams.CustomTool;
type EndCallTool = Retell.LlmCreateParams.EndCallTool;
export type GeneralTool = CustomTool | EndCallTool;

interface JsonSchemaProperty {
  type: 'string' | 'object';
  description?: string;
  enum?: readonly string[];
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export const patientFieldProperties: Record<string, JsonSchemaProperty> = {
  first_name: {
    type: 'string',
    description: 'First name. Letters, hyphens, and apostrophes only.',
  },
  last_name: {
    type: 'string',
    description: 'Last name. Letters, hyphens, and apostrophes only.',
  },
  date_of_birth: {
    type: 'string',
    description: 'Date of birth in MM/DD/YYYY format.',
  },
  sex: {
    type: 'string',
    enum: SEX_VALUES,
    description: 'Sex as stated by the caller.',
  },
  phone_number: {
    type: 'string',
    description: '10-digit U.S. phone number, digits only.',
  },
  email: {
    type: 'string',
    description: 'Email address, only if the caller chose to provide one.',
  },
  address_line_1: {
    type: 'string',
    description: 'Street address, for example "123 Main Street".',
  },
  address_line_2: {
    type: 'string',
    description: 'Apartment, suite, or unit, if any.',
  },
  city: {
    type: 'string',
    description: 'City.',
  },
  state: {
    type: 'string',
    enum: US_STATE_CODES,
    description: 'Two-letter U.S. state code.',
  },
  zip_code: {
    type: 'string',
    description: 'ZIP code: 5 digits, or ZIP+4 like 12345-6789.',
  },
  insurance_provider: {
    type: 'string',
    description: 'Insurance company name, if provided.',
  },
  insurance_member_id: {
    type: 'string',
    description: 'Alphanumeric insurance member or subscriber ID, if provided.',
  },
  preferred_language: {
    type: 'string',
    description: 'Preferred language. Defaults to English when omitted.',
  },
  emergency_contact_name: {
    type: 'string',
    description: 'Emergency contact full name, if provided.',
  },
  emergency_contact_phone: {
    type: 'string',
    description: 'Emergency contact 10-digit U.S. phone number, if provided.',
  },
};

export const REQUIRED_PATIENT_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'sex',
  'phone_number',
  'address_line_1',
  'city',
  'state',
  'zip_code',
];

const TOOL_TIMEOUT_MS = 20_000;

type CustomToolSpec = Omit<CustomTool, 'type' | 'url' | 'method' | 'timeout_ms' | 'max_retry'>;

// Writes are never retried by Retell: a retried register_patient would create a duplicate record.
function customTool(toolsUrl: string, spec: CustomToolSpec): CustomTool {
  return {
    type: 'custom',
    url: toolsUrl,
    method: 'POST',
    timeout_ms: TOOL_TIMEOUT_MS,
    max_retry: 0,
    speak_after_execution: true,
    ...spec,
  };
}

function spokenWhileRunning(
  message: string,
): Pick<
  CustomTool,
  'speak_during_execution' | 'execution_message_type' | 'execution_message_description'
> {
  return {
    speak_during_execution: true,
    execution_message_type: 'static_text',
    execution_message_description: message,
  };
}

export function buildGeneralTools(toolsUrl: string): GeneralTool[] {
  return [
    customTool(toolsUrl, {
      name: TOOL_NAMES.lookupPatientByPhone,
      description:
        'Check whether a patient record already exists for a phone number. Call this as soon as the caller provides their phone number.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: '10-digit U.S. phone number, digits only.' },
        },
        required: ['phone_number'],
      },
      speak_during_execution: false,
    }),
    customTool(toolsUrl, {
      name: TOOL_NAMES.registerPatient,
      description:
        'Save a new patient record. Call only after the caller has confirmed every field. Returns ok true with a patient_id, or validation_errors listing the fields that must be asked again.',
      parameters: {
        type: 'object',
        properties: patientFieldProperties,
        required: REQUIRED_PATIENT_FIELDS,
      },
      ...spokenWhileRunning('One moment while I save that.'),
    }),
    customTool(toolsUrl, {
      name: TOOL_NAMES.updatePatient,
      description:
        'Update an existing patient record. Include only the fields that changed. Returns ok true with the updated record, or validation_errors listing the fields that must be asked again.',
      parameters: {
        type: 'object',
        properties: {
          patient_id: {
            type: 'string',
            description: 'The patient_id returned by lookup_patient_by_phone.',
          },
          changes: {
            type: 'object',
            description: 'Only the fields that changed.',
            properties: patientFieldProperties,
          },
        },
        required: ['patient_id', 'changes'],
      },
      ...spokenWhileRunning('One moment while I update that.'),
    }),
    customTool(toolsUrl, {
      name: TOOL_NAMES.getAvailableAppointmentSlots,
      description: 'List upcoming appointment times at the clinic that are still open.',
      parameters: { type: 'object', properties: {} },
      speak_during_execution: false,
    }),
    customTool(toolsUrl, {
      name: TOOL_NAMES.bookAppointment,
      description:
        'Book an appointment for a registered patient at one of the times returned by get_available_appointment_slots.',
      parameters: {
        type: 'object',
        properties: {
          patient_id: { type: 'string', description: 'The patient_id of the registered patient.' },
          scheduled_at: {
            type: 'string',
            description: 'The scheduled_at value of the chosen slot, exactly as returned.',
          },
          reason: {
            type: 'string',
            description: 'Brief reason for the visit, if the caller mentioned one.',
          },
        },
        required: ['patient_id', 'scheduled_at'],
      },
      ...spokenWhileRunning('Let me book that for you.'),
    }),
    {
      type: 'end_call',
      name: END_CALL_TOOL_NAME,
      description: 'Hang up after the caller has been thanked and said goodbye.',
    },
  ];
}
