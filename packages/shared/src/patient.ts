import { z } from 'zod';
import { isoDateFromMdy, todayIsoDate } from './date-of-birth';
import { normalizeUsPhoneNumber } from './phone';
import { US_STATE_CODES } from './us-states';

export const SEX_VALUES = ['male', 'female', 'other', 'decline_to_answer'] as const;
export type Sex = (typeof SEX_VALUES)[number];

export const SEX_LABELS: Record<Sex, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  decline_to_answer: 'Decline to answer',
};

export const DEFAULT_PREFERRED_LANGUAGE = 'English';
export const EARLIEST_DATE_OF_BIRTH = '1900-01-01';

const SEX_ERROR = 'Sex must be one of: male, female, other, decline_to_answer';

const personName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be 50 characters or fewer`)
    .regex(/^[\p{L}][\p{L}'-]*$/u, `${label} may only contain letters, hyphens, and apostrophes`);

const fullName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be 100 characters or fewer`)
    .regex(
      /^[\p{L}][\p{L}' .-]*$/u,
      `${label} may only contain letters, spaces, hyphens, and apostrophes`,
    );

const usPhoneNumber = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizeUsPhoneNumber(value);
      if (!normalized) {
        ctx.addIssue({
          code: 'custom',
          message: `${label} must be a valid 10-digit U.S. phone number`,
        });
        return z.NEVER;
      }
      return normalized;
    });

const dateOfBirth = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const isoDate = isoDateFromMdy(value);
    if (!isoDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Date of birth must be a real date in MM/DD/YYYY format',
      });
      return z.NEVER;
    }
    if (isoDate > todayIsoDate()) {
      ctx.addIssue({ code: 'custom', message: 'Date of birth cannot be in the future' });
      return z.NEVER;
    }
    if (isoDate < EARLIEST_DATE_OF_BIRTH) {
      ctx.addIssue({ code: 'custom', message: 'Date of birth must be on or after 01/01/1900' });
      return z.NEVER;
    }
    return isoDate;
  });

const usState = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z.enum(US_STATE_CODES, {
      error: 'State must be a valid 2-letter U.S. state abbreviation',
    }),
  );

const zipCode = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be 5 digits or ZIP+4 (12345-6789)');

const addressLine = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(200, `${label} must be 200 characters or fewer`);

const city = z
  .string()
  .trim()
  .min(1, 'City is required')
  .max(100, 'City must be 100 characters or fewer');

const email = z.email('Email must be a valid email address').max(254);

const insuranceProvider = z
  .string()
  .trim()
  .min(1, 'Insurance provider is required when given')
  .max(100, 'Insurance provider must be 100 characters or fewer');

const insuranceMemberId = z
  .string()
  .trim()
  .min(1, 'Insurance member ID is required when given')
  .max(50, 'Insurance member ID must be 50 characters or fewer')
  .regex(/^[A-Za-z0-9]+$/, 'Insurance member ID must be alphanumeric');

const preferredLanguage = z
  .string()
  .trim()
  .min(1, 'Preferred language is required when given')
  .max(50, 'Preferred language must be 50 characters or fewer');

export const createPatientSchema = z.strictObject({
  first_name: personName('First name'),
  last_name: personName('Last name'),
  date_of_birth: dateOfBirth,
  sex: z.enum(SEX_VALUES, { error: SEX_ERROR }),
  phone_number: usPhoneNumber('Phone number'),
  email: email.nullish(),
  address_line_1: addressLine('Address line 1'),
  address_line_2: addressLine('Address line 2').nullish(),
  city,
  state: usState,
  zip_code: zipCode,
  insurance_provider: insuranceProvider.nullish(),
  insurance_member_id: insuranceMemberId.nullish(),
  preferred_language: preferredLanguage.default(DEFAULT_PREFERRED_LANGUAGE),
  emergency_contact_name: fullName('Emergency contact name').nullish(),
  emergency_contact_phone: usPhoneNumber('Emergency contact phone').nullish(),
});

export const updatePatientSchema = z
  .strictObject({
    first_name: personName('First name').optional(),
    last_name: personName('Last name').optional(),
    date_of_birth: dateOfBirth.optional(),
    sex: z.enum(SEX_VALUES, { error: SEX_ERROR }).optional(),
    phone_number: usPhoneNumber('Phone number').optional(),
    email: email.nullish(),
    address_line_1: addressLine('Address line 1').optional(),
    address_line_2: addressLine('Address line 2').nullish(),
    city: city.optional(),
    state: usState.optional(),
    zip_code: zipCode.optional(),
    insurance_provider: insuranceProvider.nullish(),
    insurance_member_id: insuranceMemberId.nullish(),
    preferred_language: preferredLanguage.optional(),
    emergency_contact_name: fullName('Emergency contact name').nullish(),
    emergency_contact_phone: usPhoneNumber('Emergency contact phone').nullish(),
  })
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'At least one field must be provided',
  });

export const listPatientsQuerySchema = z.strictObject({
  last_name: z.string().trim().min(1).max(50).optional(),
  date_of_birth: dateOfBirth.optional(),
  phone_number: usPhoneNumber('Phone number').optional(),
});

export const patientIdSchema = z.uuid('Patient ID must be a valid UUID');

export const patientSchema = z.object({
  patient_id: z.uuid(),
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.string().describe('MM/DD/YYYY'),
  sex: z.enum(SEX_VALUES),
  phone_number: z.string().describe('10 digits, no formatting'),
  email: z.string().nullable(),
  address_line_1: z.string(),
  address_line_2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  zip_code: z.string(),
  insurance_provider: z.string().nullable(),
  insurance_member_id: z.string().nullable(),
  preferred_language: z.string(),
  emergency_contact_name: z.string().nullable(),
  emergency_contact_phone: z.string().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  deleted_at: z.iso.datetime().nullable(),
});

export type Patient = z.infer<typeof patientSchema>;
export type CreatePatientInput = z.input<typeof createPatientSchema>;
export type NewPatient = z.output<typeof createPatientSchema>;
export type UpdatePatientInput = z.input<typeof updatePatientSchema>;
export type PatientChanges = z.output<typeof updatePatientSchema>;
export type PatientFilters = z.output<typeof listPatientsQuerySchema>;
