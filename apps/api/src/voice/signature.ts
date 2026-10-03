import Retell from 'retell-sdk';

export const SIGNATURE_HEADER = 'x-retell-signature';

export function verifyRetellSignature(
  apiKey: string,
  rawBody: string,
  signature: string | undefined,
): Promise<boolean> {
  if (!signature) return Promise.resolve(false);
  return Retell.verify(rawBody, apiKey, signature);
}
