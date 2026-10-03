import { createPatientSchema } from '@voice-intake/shared';
import { describe, expect, it } from 'vitest';
import {
  buildGeneralTools,
  END_CALL_TOOL_NAME,
  patientFieldProperties,
  REQUIRED_PATIENT_FIELDS,
  TOOL_NAMES,
} from '../src/voice/tools';

const TOOLS_URL = 'https://api.example.com/webhooks/retell/tools';

describe('voice tool definitions', () => {
  it('expose exactly the fields the API accepts', () => {
    expect(Object.keys(patientFieldProperties).sort()).toEqual(
      Object.keys(createPatientSchema.shape).sort(),
    );
  });

  it('mark as required exactly the fields the API requires', () => {
    const requiredByApi = Object.entries(createPatientSchema.shape)
      .filter(([, schema]) => !schema.safeParse(undefined).success)
      .map(([field]) => field)
      .sort();

    expect([...REQUIRED_PATIENT_FIELDS].sort()).toEqual(requiredByApi);
  });

  it('define every tool the webhook can dispatch, plus end_call', () => {
    const tools = buildGeneralTools(TOOLS_URL);
    const custom = tools.filter((tool) => tool.type === 'custom');

    expect(custom.map((tool) => tool.name).sort()).toEqual(Object.values(TOOL_NAMES).sort());
    expect(tools.some((tool) => tool.type === 'end_call' && tool.name === END_CALL_TOOL_NAME)).toBe(
      true,
    );
  });

  it('point every custom tool at the tools endpoint and never retry writes', () => {
    for (const tool of buildGeneralTools(TOOLS_URL)) {
      if (tool.type !== 'custom') continue;
      expect(tool.url).toBe(TOOLS_URL);
      expect(tool.max_retry).toBe(0);
    }
  });
});
