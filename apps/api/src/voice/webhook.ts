import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { CallRepository } from '../calls/repository';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../http/errors';
import {
  callEventSchema,
  customFunctionRequestSchema,
  HANDLED_CALL_EVENTS,
  type CallEvent,
} from './messages';
import { SIGNATURE_HEADER, verifyRetellSignature } from './signature';
import type { ToolCallContext, ToolHandler } from './tool-handlers';
import type { ToolName } from './tools';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export interface RetellWebhookOptions {
  apiKey: string;
  tools: Record<ToolName, ToolHandler>;
  calls: CallRepository;
}

export const TOOLS_PATH = '/webhooks/retell/tools';
export const EVENTS_PATH = '/webhooks/retell/events';

const TOOL_FAILURE_MESSAGE = 'The clinic system is temporarily unavailable.';

export const retellWebhookRoutes: FastifyPluginAsync<RetellWebhookOptions> = async (
  app,
  { apiKey, tools, calls },
) => {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    request.rawBody = body as string;
    try {
      done(null, JSON.parse(request.rawBody));
    } catch {
      done(new BadRequestError('Malformed JSON body'));
    }
  });

  app.addHook('preHandler', async (request) => {
    const valid = await verifyRetellSignature(
      apiKey,
      request.rawBody ?? '',
      headerValue(request, SIGNATURE_HEADER),
    );
    if (!valid) throw new UnauthorizedError('Invalid webhook signature');
  });

  app.post(
    TOOLS_PATH,
    {
      schema: {
        tags: ['voice'],
        summary: 'Retell custom-function endpoint: the agent calls its tools here (signed)',
      },
    },
    async (request) => {
      const parsed = customFunctionRequestSchema.safeParse(request.body);
      if (!parsed.success) throw new BadRequestError('Malformed custom function request');

      const { name, args, call } = parsed.data;
      const handler = tools[name as ToolName];
      if (!handler) throw new NotFoundError(`Tool ${name}`);

      const context: ToolCallContext = {
        callId: call?.call_id,
        callerPhoneNumber: call?.from_number,
      };
      request.log.info(
        { event: 'tool.called', callId: context.callId, tool: name, args },
        'Voice agent tool call',
      );

      try {
        return await handler(args, context);
      } catch (error) {
        request.log.error({ err: error, tool: name, callId: context.callId }, 'Tool call failed');
        return { ok: false, error: TOOL_FAILURE_MESSAGE };
      }
    },
  );

  app.post(
    EVENTS_PATH,
    {
      schema: {
        tags: ['voice'],
        summary: 'Retell call lifecycle webhook: call_started, call_ended, call_analyzed (signed)',
      },
    },
    async (request, reply) => {
      const parsed = callEventSchema.safeParse(request.body);
      if (!parsed.success) throw new BadRequestError('Malformed call event');

      if (!HANDLED_CALL_EVENTS.has(parsed.data.event)) {
        request.log.debug({ event: parsed.data.event }, 'Ignoring unhandled Retell event');
        return reply.status(204).send();
      }

      await recordCallEvent(parsed.data, request);
      return reply.status(204).send();
    },
  );

  async function recordCallEvent({ event, call }: CallEvent, request: FastifyRequest) {
    if (event === 'call_started') {
      request.log.info(
        { event: 'call.started', callId: call.call_id, from: call.from_number },
        'Voice call started',
      );
      return;
    }

    await calls.recordOutcome({
      provider_call_id: call.call_id,
      caller_phone_number: call.from_number ?? null,
      ended_reason: call.disconnection_reason ?? null,
      summary: call.call_analysis?.call_summary ?? null,
      transcript: call.transcript ?? null,
      started_at: call.start_timestamp ? new Date(call.start_timestamp) : null,
      ended_at: call.end_timestamp ? new Date(call.end_timestamp) : null,
    });
    request.log.info(
      {
        event: event === 'call_ended' ? 'call.ended' : 'call.analyzed',
        callId: call.call_id,
        endedReason: call.disconnection_reason,
        summary: call.call_analysis?.call_summary,
        transcript: call.transcript,
      },
      event === 'call_ended' ? 'Voice call ended' : 'Voice call analyzed',
    );
  }
};

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
