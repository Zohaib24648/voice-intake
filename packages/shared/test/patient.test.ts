import { describe, expect, it } from 'vitest';
import { createPatientSchema, updatePatientSchema } from '../src/patient';
import { isoDateFromMdy, mdyFromIsoDate } from '../src/date-of-birth';
import { formatUsPhoneNumber, normalizeUsPhoneNumber } from '../src/phone';

describe('normalizeUsPhoneNumber', () => {
  it.each([
    ['5551234567', '5551234567'],
    ['(555) 123-4567', '5551234567'],
    ['+1 555 123 4567', '5551234567'],
    ['1-555-123-4567', '5551234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeUsPhoneNumber(input)).toBe(expected);
  });

  it.each(['123', '555123456', '25551234567', '+44 20 7946 0958', ''])('rejects %s', (input) => {
    expect(normalizeUsPhoneNumber(input)).toBeNull();
  });

  it('formats ten digits for display', () => {
    expect(formatUsPhoneNumber('5551234567')).toBe('(555) 123-4567');
  });
});

describe('date of birth conversion', () => {
  it('converts MM/DD/YYYY to ISO and back', () => {
    expect(isoDateFromMdy('03/05/1985')).toBe('1985-03-05');
    expect(mdyFromIsoDate('1985-03-05')).toBe('03/05/1985');
  });

  it('accepts leap days only in leap years', () => {
    expect(isoDateFromMdy('02/29/2000')).toBe('2000-02-29');
    expect(isoDateFromMdy('02/29/1999')).toBeNull();
  });

  it.each(['02/30/1990', '13/01/1990', '1990-01-01', '3/5/1985', 'March 5 1985'])(
    'rejects %s',
    (input) => {
      expect(isoDateFromMdy(input)).toBeNull();
    },
  );
});

describe('createPatientSchema', () => {
  const base = {
    first_name: ' Jane ',
    last_name: "O'Brien-Smith",
    date_of_birth: '03/15/1985',
    sex: 'female',
    phone_number: '(555) 123-4567',
    address_line_1: '123 Main St',
    city: 'Springfield',
    state: 'il',
    zip_code: '62701-1234',
  };

  it('normalizes whitespace, phone, state, and applies defaults', () => {
    const result = createPatientSchema.parse(base);

    expect(result).toMatchObject({
      first_name: 'Jane',
      phone_number: '5551234567',
      state: 'IL',
      date_of_birth: '1985-03-15',
      preferred_language: 'English',
    });
  });

  it('reports every invalid field with a specific message', () => {
    const result = createPatientSchema.safeParse({
      ...base,
      first_name: 'J4ne',
      date_of_birth: '12/31/2999',
      phone_number: '12345',
      email: 'not-an-email',
      insurance_member_id: 'ABC-123',
    });

    expect(result.success).toBe(false);
    const messages = Object.fromEntries(
      result.error!.issues.map((issue) => [issue.path.join('.'), issue.message]),
    );
    expect(messages).toEqual({
      first_name: 'First name may only contain letters, hyphens, and apostrophes',
      date_of_birth: 'Date of birth cannot be in the future',
      phone_number: 'Phone number must be a valid 10-digit U.S. phone number',
      email: 'Email must be a valid email address',
      insurance_member_id: 'Insurance member ID must be alphanumeric',
    });
  });

  it('rejects unknown fields', () => {
    const result = createPatientSchema.safeParse({ ...base, ssn: '123-45-6789' });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.code).toBe('unrecognized_keys');
  });
});

describe('updatePatientSchema', () => {
  it('requires at least one field', () => {
    expect(updatePatientSchema.safeParse({}).success).toBe(false);
  });

  it('allows clearing optional fields with null but not required ones', () => {
    expect(updatePatientSchema.safeParse({ email: null }).success).toBe(true);
    expect(updatePatientSchema.safeParse({ first_name: null }).success).toBe(false);
  });
});
