import Retell from 'retell-sdk';
import { z } from 'zod';
import {
  AGENT_NAME,
  DEFAULT_VOICE_ID,
  PHONE_NUMBER_NICKNAME,
  buildAgentDefinition,
  buildLlmDefinition,
  type VoiceEndpoints,
} from '../src/voice/agent';
import { EVENTS_PATH, TOOLS_PATH } from '../src/voice/webhook';

const DEFAULT_PHONE_AREA_CODE = '415';

const env = z
  .object({
    RETELL_API_KEY: z.string().min(1, 'RETELL_API_KEY is required'),
    API_BASE_URL: z.url({ error: 'API_BASE_URL must be the public URL of the deployed API' }),
    RETELL_VOICE_ID: z
      .string()
      .optional()
      .transform((value) => value || DEFAULT_VOICE_ID),
    RETELL_PHONE_AREA_CODE: z
      .union([
        z.literal(''),
        z.string().regex(/^\d{3}$/, 'RETELL_PHONE_AREA_CODE must be 3 digits'),
      ])
      .optional()
      .transform((value) => value || DEFAULT_PHONE_AREA_CODE),
  })
  .parse(process.env);

const retell = new Retell({ apiKey: env.RETELL_API_KEY });
const endpoints: VoiceEndpoints = {
  toolsUrl: `${env.API_BASE_URL}${TOOLS_PATH}`,
  eventsUrl: `${env.API_BASE_URL}${EVENTS_PATH}`,
};

await assertVoiceExists(env.RETELL_VOICE_ID);
const agent = await ensureAgent();
// Publish replies with an empty body, which the SDK would fail to parse as JSON.
await retell.agent.publish(agent.agent_id, { version: agent.version }).asResponse();
const phoneNumber = await ensurePhoneNumber(agent.agent_id);

console.log(`Agent:        ${AGENT_NAME} (${agent.agent_id}, version ${agent.version})`);
console.log(`Tools URL:    ${endpoints.toolsUrl}`);
console.log(`Events URL:   ${endpoints.eventsUrl}`);
console.log(`Phone number: ${phoneNumber.phone_number_pretty ?? phoneNumber.phone_number}`);

async function assertVoiceExists(voiceId: string): Promise<void> {
  const voices = await retell.voice.list();
  if (voices.some((voice) => voice.voice_id === voiceId)) return;

  const suggestions = voices
    .filter((voice) => voice.provider === 'elevenlabs')
    .slice(0, 12)
    .map((voice) => `${voice.voice_id} (${voice.voice_name}, ${voice.gender})`)
    .join(', ');
  throw new Error(`Voice ${voiceId} is not available. ElevenLabs voices include: ${suggestions}`);
}

async function ensureAgent(): Promise<Retell.AgentResponse> {
  const llmDefinition = buildLlmDefinition(endpoints);
  const listed = await findPaged(
    (pagination_key) => retell.agent.list({ pagination_key }),
    (item) => item.agent_name === AGENT_NAME,
  );
  let existing = listed ? await retell.agent.retrieve(listed.agent_id) : undefined;

  // A published version (and its LLM) is read-only, so edits go to a new draft based on it.
  if (existing?.is_published) {
    await retell.agent.createVersion(existing.agent_id, { base_version: existing.version });
    existing = await retell.agent.retrieve(existing.agent_id);
  }

  if (existing && existing.response_engine.type === 'retell-llm') {
    await retell.llm.update(existing.response_engine.llm_id, llmDefinition);
    return retell.agent.update(
      existing.agent_id,
      buildAgentDefinition({
        llmId: existing.response_engine.llm_id,
        eventsUrl: endpoints.eventsUrl,
        voiceId: env.RETELL_VOICE_ID,
      }),
    );
  }

  const llm = await retell.llm.create(llmDefinition);
  return retell.agent.create(
    buildAgentDefinition({
      llmId: llm.llm_id,
      eventsUrl: endpoints.eventsUrl,
      voiceId: env.RETELL_VOICE_ID,
    }),
  );
}

async function ensurePhoneNumber(agentId: string): Promise<Retell.PhoneNumberResponse> {
  const inboundAgents = [{ agent_id: agentId, weight: 1 }];
  const existing = await findPaged(
    (pagination_key) => retell.phoneNumber.list({ pagination_key }),
    (phoneNumber) => phoneNumber.nickname === PHONE_NUMBER_NICKNAME,
  );

  if (existing) {
    const alreadyBound = existing.inbound_agents?.some((agent) => agent.agent_id === agentId);
    return alreadyBound
      ? existing
      : retell.phoneNumber.update(existing.phone_number, { inbound_agents: inboundAgents });
  }

  return retell.phoneNumber.create({
    area_code: Number(env.RETELL_PHONE_AREA_CODE),
    nickname: PHONE_NUMBER_NICKNAME,
    inbound_agents: inboundAgents,
  });
}

interface Page<T> {
  items: T[];
  has_more: boolean;
  pagination_key?: string;
}

async function findPaged<T>(
  fetchPage: (paginationKey: string | undefined) => Promise<Page<T>>,
  matches: (item: T) => boolean,
): Promise<T | undefined> {
  let paginationKey: string | undefined;
  do {
    const page = await fetchPage(paginationKey);
    const match = page.items.find(matches);
    if (match) return match;
    paginationKey = page.has_more ? page.pagination_key : undefined;
  } while (paginationKey);
  return undefined;
}
