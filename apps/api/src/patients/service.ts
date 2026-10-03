import type { NewPatient, Patient, PatientChanges, PatientFilters } from '@voice-intake/shared';
import { NotFoundError } from '../http/errors';
import type { PatientRepository } from './repository';

export class PatientService {
  constructor(private readonly repository: PatientRepository) {}

  list(filters: PatientFilters): Promise<Patient[]> {
    return this.repository.list(filters);
  }

  async get(patientId: string): Promise<Patient> {
    const patient = await this.repository.findById(patientId);
    if (!patient) throw new NotFoundError('Patient');
    return patient;
  }

  findByPhoneNumber(phoneNumber: string): Promise<Patient | null> {
    return this.repository.findByPhoneNumber(phoneNumber);
  }

  create(input: NewPatient): Promise<Patient> {
    return this.repository.create(input);
  }

  async update(patientId: string, changes: PatientChanges): Promise<Patient> {
    const patient = await this.repository.update(patientId, changes);
    if (!patient) throw new NotFoundError('Patient');
    return patient;
  }

  async remove(patientId: string): Promise<Patient> {
    const patient = await this.repository.softDelete(patientId);
    if (!patient) throw new NotFoundError('Patient');
    return patient;
  }
}
