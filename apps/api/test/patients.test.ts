import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { patients } from '../src/db/schema';
import { createPatient, createTestContext, validPatientInput, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

describe('POST /patients', () => {
  it('creates a patient and returns the normalized record in the envelope', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/patients',
      payload: validPatientInput,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.error).toBeNull();
    expect(body.data).toMatchObject({
      first_name: 'Jane',
      last_name: 'Davis',
      date_of_birth: '03/15/1985',
      sex: 'female',
      phone_number: '5550101234',
      state: 'IL',
      zip_code: '62701',
      preferred_language: 'English',
      email: null,
      deleted_at: null,
    });
    expect(body.data.patient_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(body.data.created_at).toISOString()).toBe(body.data.created_at);
  });

  it('rejects invalid fields with 422 and a field-level error list', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/patients',
      payload: {
        ...validPatientInput,
        phone_number: '123',
        date_of_birth: '12/31/2999',
        state: 'XX',
        zip_code: '1234',
        sex: 'unknown',
        nickname: 'JD',
      },
    });

    expect(response.statusCode).toBe(422);
    const { error } = response.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    const fields = error.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'phone_number',
        'date_of_birth',
        'state',
        'zip_code',
        'sex',
        'nickname',
      ]),
    );
  });

  it('rejects an impossible calendar date', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/patients',
      payload: { ...validPatientInput, date_of_birth: '02/30/1990' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.details).toEqual([
      { field: 'date_of_birth', message: 'Date of birth must be a real date in MM/DD/YYYY format' },
    ]);
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/patients',
      headers: { 'content-type': 'application/json' },
      payload: '{"first_name": ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().data).toBeNull();
  });
});

describe('GET /patients/:id', () => {
  it('returns the patient', async () => {
    const created = await createPatient(ctx.app, { phone_number: '5550102000' });
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/patients/${created.patient_id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.patient_id).toBe(created.patient_id);
  });

  it('returns 404 for an unknown id', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/patients/00000000-0000-4000-8000-000000000000',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed id', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/patients/not-a-uuid' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /patients', () => {
  it('filters by last name (case-insensitive), normalized phone, and date of birth', async () => {
    await createPatient(ctx.app, {
      last_name: 'Filterson',
      phone_number: '5550103000',
      date_of_birth: '01/02/1970',
    });
    await createPatient(ctx.app, {
      last_name: 'Other',
      phone_number: '5550103001',
      date_of_birth: '01/02/1970',
    });

    const byName = await ctx.app.inject({ method: 'GET', url: '/patients?last_name=FILTERSON' });
    expect(byName.json().data).toHaveLength(1);
    expect(byName.json().data[0].last_name).toBe('Filterson');

    const byPhone = await ctx.app.inject({
      method: 'GET',
      url: '/patients?phone_number=%2B1%20555-010-3001',
    });
    expect(byPhone.json().data).toHaveLength(1);
    expect(byPhone.json().data[0].last_name).toBe('Other');

    const byDob = await ctx.app.inject({
      method: 'GET',
      url: '/patients?date_of_birth=01/02/1970',
    });
    expect(byDob.json().data).toHaveLength(2);
  });

  it('rejects unknown query parameters with 400', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/patients?first_name=Jane' });

    expect(response.statusCode).toBe(400);
  });
});

describe('PUT /patients/:id', () => {
  it('applies a partial update and bumps updated_at', async () => {
    const created = await createPatient(ctx.app, { phone_number: '5550104000' });
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/patients/${created.patient_id}`,
      payload: { last_name: "O'Brien", email: 'jane@example.com', insurance_provider: null },
    });

    expect(response.statusCode).toBe(200);
    const { data } = response.json();
    expect(data).toMatchObject({
      last_name: "O'Brien",
      email: 'jane@example.com',
      first_name: 'Jane',
    });
    expect(new Date(data.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updated_at as string).getTime(),
    );
  });

  it('rejects an empty update with 422', async () => {
    const created = await createPatient(ctx.app, { phone_number: '5550104001' });
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/patients/${created.patient_id}`,
      payload: {},
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('DELETE /patients/:id', () => {
  it('soft-deletes: the record keeps its row but disappears from reads', async () => {
    const created = await createPatient(ctx.app, { phone_number: '5550105000' });

    const deleted = await ctx.app.inject({
      method: 'DELETE',
      url: `/patients/${created.patient_id}`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data.deleted_at).not.toBeNull();

    const fetched = await ctx.app.inject({ method: 'GET', url: `/patients/${created.patient_id}` });
    expect(fetched.statusCode).toBe(404);

    const listed = await ctx.app.inject({
      method: 'GET',
      url: '/patients?phone_number=5550105000',
    });
    expect(listed.json().data).toHaveLength(0);

    const again = await ctx.app.inject({
      method: 'DELETE',
      url: `/patients/${created.patient_id}`,
    });
    expect(again.statusCode).toBe(404);

    const rows = await ctx.db.select().from(patients);
    expect(
      rows.some((row) => row.patient_id === created.patient_id && row.deleted_at !== null),
    ).toBe(true);
  });
});

describe('database constraints', () => {
  it('rejects rows that bypass the API validation layer', async () => {
    const insert = ctx.db.insert(patients).values({
      first_name: 'Bad',
      last_name: 'Row',
      date_of_birth: '1990-01-01',
      sex: 'male',
      phone_number: '12345',
      address_line_1: 'x',
      city: 'y',
      state: 'CA',
      zip_code: '90210',
    });

    await expect(insert).rejects.toSatisfy((error: unknown) =>
      String((error as { cause?: unknown }).cause ?? error).includes(
        'patients_phone_number_digits',
      ),
    );
  });
});

describe('GET /health', () => {
  it('reports database connectivity', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ status: 'ok', database: 'ok' });
  });
});
