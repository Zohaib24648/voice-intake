import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SIGNATURE_HEADER } from '../src/voice/signature';
import {
  callEventRequest,
  createPatient,
  createTestContext,
  toolRequest,
  validPatientInput,
  type TestContext,
} from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

describe('webhook authentication', () => {
  it('rejects requests signed with the wrong key', async () => {
    const request = await toolRequest('lookup_patient_by_phone', {}, undefined, 'wrong-key');
    const response = await ctx.app.inject(request);

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests whose body was altered after signing', async () => {
    const request = await toolRequest('lookup_patient_by_phone', { phone_number: '5550100000' });
    const response = await ctx.app.inject({
      ...request,
      payload: JSON.stringify({ name: 'register_patient', args: {}, call: { call_id: 'x' } }),
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects requests without a signature header', async () => {
    const request = await toolRequest('lookup_patient_by_phone', {});
    const { [SIGNATURE_HEADER]: _signature, ...headers } = request.headers;
    const response = await ctx.app.inject({ ...request, headers });

    expect(response.statusCode).toBe(401);
  });

  it('acknowledges call events it does not act on', async () => {
    const response = await ctx.app.inject(
      await callEventRequest('transcript_updated', { call_id: 'call_x', transcript: 'hi' }),
    );

    expect(response.statusCode).toBe(204);
  });
});

describe('register_patient tool', () => {
  it('saves a confirmed registration and links the call', async () => {
    const response = await ctx.app.inject(
      await toolRequest('register_patient', { ...validPatientInput, phone_number: '5550201000' }),
    );

    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result).toMatchObject({ ok: true, first_name: 'Jane' });

    const fetched = await ctx.app.inject({ method: 'GET', url: `/patients/${result.patient_id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().data.phone_number).toBe('5550201000');

    const calls = await ctx.app.inject({
      method: 'GET',
      url: `/patients/${result.patient_id}/calls`,
    });
    expect(calls.json().data).toHaveLength(1);
    expect(calls.json().data[0]).toMatchObject({
      provider_call_id: 'call_test_1',
      caller_phone_number: '+15550101234',
    });
  });

  it('returns field-level validation errors instead of saving', async () => {
    const response = await ctx.app.inject(
      await toolRequest('register_patient', {
        ...validPatientInput,
        phone_number: '123',
        date_of_birth: '01/01/2999',
      }),
    );

    const result = response.json();
    expect(result.ok).toBe(false);
    expect(result.validation_errors.map((e: { field: string }) => e.field)).toEqual([
      'date_of_birth',
      'phone_number',
    ]);
  });

  it('reports unknown tools as not found', async () => {
    const response = await ctx.app.inject(await toolRequest('delete_everything', {}));

    expect(response.statusCode).toBe(404);
  });
});

describe('lookup_patient_by_phone tool', () => {
  it('finds an existing patient by normalized phone number', async () => {
    const created = await createPatient(ctx.app, {
      first_name: 'Returning',
      phone_number: '5550202000',
    });
    const response = await ctx.app.inject(
      await toolRequest('lookup_patient_by_phone', { phone_number: '+1 (555) 020-2000' }),
    );

    const result = response.json();
    expect(result.found).toBe(true);
    expect(result.patient.patient_id).toBe(created.patient_id);
    expect(result.patient.first_name).toBe('Returning');
  });

  it('reports when no patient matches', async () => {
    const response = await ctx.app.inject(
      await toolRequest('lookup_patient_by_phone', { phone_number: '5550209999' }),
    );

    expect(response.json()).toEqual({ found: false });
  });
});

describe('update_patient tool', () => {
  it('applies only the provided changes', async () => {
    const created = await createPatient(ctx.app, { phone_number: '5550203000' });
    const response = await ctx.app.inject(
      await toolRequest('update_patient', {
        patient_id: created.patient_id,
        changes: { last_name: 'Davis-Smith', city: 'Chicago' },
      }),
    );

    const result = response.json();
    expect(result.ok).toBe(true);
    expect(result.patient).toMatchObject({
      last_name: 'Davis-Smith',
      city: 'Chicago',
      first_name: 'Jane',
    });
  });

  it('reports an unknown patient without throwing', async () => {
    const response = await ctx.app.inject(
      await toolRequest('update_patient', {
        patient_id: '00000000-0000-4000-8000-000000000000',
        changes: { city: 'Nowhere' },
      }),
    );

    expect(response.json().ok).toBe(false);
  });
});

describe('appointments', () => {
  it('offers open slots and books one for a patient', async () => {
    const created = await createPatient(ctx.app, { phone_number: '5550204000' });
    const slots = await ctx.app.inject(await toolRequest('get_available_appointment_slots', {}));
    const [slot] = slots.json().slots;
    expect(slot.label).toMatch(/Eastern$/);

    const booked = await ctx.app.inject(
      await toolRequest('book_appointment', {
        patient_id: created.patient_id,
        scheduled_at: slot.scheduled_at,
      }),
    );
    expect(booked.json()).toMatchObject({
      ok: true,
      appointment: { scheduled_at: slot.scheduled_at },
    });

    const again = await ctx.app.inject(
      await toolRequest('book_appointment', {
        patient_id: created.patient_id,
        scheduled_at: slot.scheduled_at,
      }),
    );
    expect(again.json().ok).toBe(false);

    const listed = await ctx.app.inject({
      method: 'GET',
      url: `/patients/${created.patient_id}/appointments`,
    });
    expect(listed.json().data).toHaveLength(1);
  });
});

describe('call lifecycle events', () => {
  it('stores the transcript and later the summary against the linked patient', async () => {
    const call = { call_id: 'call_lifecycle', from_number: '+15550205000' };
    const registration = await ctx.app.inject(
      await toolRequest(
        'register_patient',
        { ...validPatientInput, phone_number: '5550205000' },
        call,
      ),
    );
    const { patient_id } = registration.json();

    const ended = await ctx.app.inject(
      await callEventRequest('call_ended', {
        ...call,
        direction: 'inbound',
        start_timestamp: Date.parse('2026-10-01T10:00:00.000Z'),
        end_timestamp: Date.parse('2026-10-01T10:05:00.000Z'),
        disconnection_reason: 'agent_hangup',
        transcript: 'Agent: Hello\nUser: Hi',
      }),
    );
    expect(ended.statusCode).toBe(204);

    const analyzed = await ctx.app.inject(
      await callEventRequest('call_analyzed', {
        ...call,
        start_timestamp: Date.parse('2026-10-01T10:00:00.000Z'),
        end_timestamp: Date.parse('2026-10-01T10:05:00.000Z'),
        disconnection_reason: 'agent_hangup',
        transcript: 'Agent: Hello\nUser: Hi',
        call_analysis: { call_summary: 'Caller registered as a new patient.' },
      }),
    );
    expect(analyzed.statusCode).toBe(204);

    const calls = await ctx.app.inject({ method: 'GET', url: `/patients/${patient_id}/calls` });
    expect(calls.json().data).toHaveLength(1);
    expect(calls.json().data[0]).toMatchObject({
      provider_call_id: 'call_lifecycle',
      ended_reason: 'agent_hangup',
      transcript: 'Agent: Hello\nUser: Hi',
      summary: 'Caller registered as a new patient.',
      started_at: '2026-10-01T10:00:00.000Z',
      ended_at: '2026-10-01T10:05:00.000Z',
    });
  });
});
