import { createPatientSchema, type CreatePatientInput } from '@voice-intake/shared';
import { loadConfig } from './config';
import { connectDatabase } from './db/client';
import { createLogger } from './logger';
import { PatientRepository } from './patients/repository';

const SEED_PATIENTS: CreatePatientInput[] = [
  {
    first_name: 'Jane',
    last_name: 'Doe',
    date_of_birth: '03/15/1985',
    sex: 'female',
    phone_number: '5550100001',
    email: 'jane.doe@example.com',
    address_line_1: '123 Maple Street',
    address_line_2: 'Apt 4B',
    city: 'Springfield',
    state: 'IL',
    zip_code: '62701',
    insurance_provider: 'Blue Cross Blue Shield',
    insurance_member_id: 'BCB123456789',
    emergency_contact_name: 'John Doe',
    emergency_contact_phone: '5550100002',
  },
  {
    first_name: 'Carlos',
    last_name: 'Rivera',
    date_of_birth: '11/02/1978',
    sex: 'male',
    phone_number: '5550100003',
    address_line_1: '890 Ocean Avenue',
    city: 'San Diego',
    state: 'CA',
    zip_code: '92101-4321',
    preferred_language: 'Spanish',
  },
];

const config = loadConfig();
const logger = createLogger(config.logLevel, config.env === 'development');
const database = connectDatabase(config.databaseUrl);
const patients = new PatientRepository(database.db);

try {
  for (const input of SEED_PATIENTS) {
    const patient = createPatientSchema.parse(input);
    const existing = await patients.findByPhoneNumber(patient.phone_number);
    if (existing) {
      logger.info(
        { patient_id: existing.patient_id },
        `Seed patient ${patient.first_name} ${patient.last_name} already exists`,
      );
      continue;
    }
    const created = await patients.create(patient);
    logger.info(
      { patient_id: created.patient_id },
      `Seeded patient ${patient.first_name} ${patient.last_name}`,
    );
  }
} finally {
  await database.close();
}
