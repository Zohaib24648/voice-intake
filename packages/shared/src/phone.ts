const US_COUNTRY_CODE = '1';
const NATIONAL_NUMBER_LENGTH = 10;

export function normalizeUsPhoneNumber(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const national =
    digits.length === NATIONAL_NUMBER_LENGTH + 1 && digits.startsWith(US_COUNTRY_CODE)
      ? digits.slice(1)
      : digits;

  return national.length === NATIONAL_NUMBER_LENGTH ? national : null;
}

export function formatUsPhoneNumber(tenDigits: string): string {
  return `(${tenDigits.slice(0, 3)}) ${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`;
}
