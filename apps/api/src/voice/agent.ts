import { readFileSync } from 'node:fs';
import { CLINIC_TIME_ZONE } from '@voice-intake/shared';
import type Retell from 'retell-sdk';
import { buildGeneralTools } from './tools';

export const AGENT_NAME = 'Lakeside Clinic Patient Intake';
export const PHONE_NUMBER_NICKNAME = 'Lakeside Clinic Intake Line';
export const DEFAULT_VOICE_ID = '11labs-Myra';

const FIRST_MESSAGE =
  'Hi, thanks for calling Lakeside Clinic! This is Ava. I can get you registered as a new patient in just a few minutes. Could I start with your first and last name?';

export interface VoiceEndpoints {
  toolsUrl: string;
  eventsUrl: string;
}

function loadSystemPrompt(): string {
  return readFileSync(new URL('./system-prompt.md', import.meta.url), 'utf8');
}

export function buildLlmDefinition({
  toolsUrl,
}: Pick<VoiceEndpoints, 'toolsUrl'>): Retell.LlmCreateParams {
  return {
    model: 'gpt-5.6-luna',
    model_temperature: 0.1,
    start_speaker: 'agent',
    begin_message: FIRST_MESSAGE,
    general_prompt: loadSystemPrompt(),
    general_tools: buildGeneralTools(toolsUrl),
  };
}

export interface AgentTarget extends Pick<VoiceEndpoints, 'eventsUrl'> {
  llmId: string;
  voiceId: string;
}

export function buildAgentDefinition({
  llmId,
  eventsUrl,
  voiceId,
}: AgentTarget): Retell.AgentCreateParams {
  return {
    agent_name: AGENT_NAME,
    response_engine: { type: 'retell-llm', llm_id: llmId },
    voice_id: voiceId,
    voice_model: 'eleven_flash_v2_5',
    language: ['en-US', 'es-ES'],
    timezone: CLINIC_TIME_ZONE,
    webhook_url: eventsUrl,
    webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
    stt_mode: 'accurate',
    denoising_mode: 'noise-cancellation',
    boosted_keywords: [
      'Lakeside Clinic',
      'ZIP code',
      'apartment',
      'suite',
      'Aetna',
      'Cigna',
      'Humana',
      'Kaiser Permanente',
      'Medicaid',
      'Medicare',
      'UnitedHealthcare',
      'Blue Cross Blue Shield',
    ],
    interruption_sensitivity: 0.8,
    responsiveness: 1,
    enable_dynamic_responsiveness: true,
    enable_backchannel: false,
    allow_user_dtmf: true,
    user_dtmf_options: { termination_key: '#', timeout_ms: 5_000 },
    end_call_after_silence_ms: 30_000,
    max_call_duration_ms: 900_000,
    post_call_analysis_model: 'gpt-5.6-luna',
    data_storage_setting: 'everything',
  };
}
