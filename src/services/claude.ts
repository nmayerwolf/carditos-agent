import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger.js';
import { retrieveContext, formatContext } from './retrieval.js';
import { buildFixtureUserMessage, FIXTURE_SPEC } from '../lib/fixture.js';
import { getVideosCatalog, formatVideosCatalog } from './videos.js';
import type { FixtureInput } from '../lib/fixture.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const systemPromptPath = path.join(__dirname, '../prompts/system-carditos.md');
const baseSystemPrompt = fs.readFileSync(systemPromptPath, 'utf-8');

const VIDEO_MARKER_RE =
  /\[VIDEO:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\s*$/i;

const fixtureToolDefinition: Anthropic.Tool = {
  name: 'generate_fixture',
  description:
    'Genera el fixture de partidos para una jornada. Llamá esta herramienta cuando tengas toda la información: categoría, canchas, equipos expandidos con su nivel y máximo de partidos por equipo.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Categoría de los equipos (M6 a M19)',
      },
      courts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Números o nombres de las canchas disponibles',
      },
      teams: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nombre del equipo (ej: San Andrés 1)' },
            type: {
              type: 'string',
              enum: ['competitivo', 'formativo'],
              description: 'Nivel del equipo',
            },
          },
          required: ['name', 'type'],
        },
        description: 'Lista plana de todos los equipos, expandidos por club',
      },
      max_matches_per_team: {
        type: 'number',
        description: 'Máximo de partidos que puede jugar cada equipo en la jornada',
      },
      mixed: {
        type: 'boolean',
        description: 'Si es true, competitivos pueden jugar contra formativos',
      },
    },
    required: ['category', 'courts', 'teams', 'max_matches_per_team'],
  },
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

async function withDelayedMessage<T>(
  factory: () => Promise<T>,
  sendMessage: ((text: string) => Promise<void>) | undefined,
  text: string,
  delayMs = 10_000,
): Promise<T> {
  if (!sendMessage) return factory();
  let timer: ReturnType<typeof setTimeout> | undefined;
  timer = setTimeout(() => {
    sendMessage(text).catch(() => {});
  }, delayMs);
  try {
    const result = await factory();
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export interface ChatOptions {
  conversationHistory?: Message[];
  maxContextMessages?: number;
  onIntermediateMessage?: (text: string) => Promise<void>;
}

export interface VideoRef {
  url: string;
  title: string;
}

async function generateFixtureWithClaude(
  input: FixtureInput,
): Promise<{ text: string; tokensUsed: number }> {
  const userMessage = buildFixtureUserMessage(input);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: {
      type: 'enabled',
      budget_tokens: 10000,
    },
    system: [
      {
        type: 'text',
        text: FIXTURE_SPEC,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content.find((c): c is Anthropic.TextBlock => c.type === 'text');
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
  return { text: text?.text ?? 'No se pudo generar el fixture.', tokensUsed };
}

export async function chat(
  query: string,
  options: ChatOptions = {},
): Promise<{ text: string; tokensUsed: number; video?: VideoRef }> {
  try {
    const { conversationHistory = [], maxContextMessages = 30, onIntermediateMessage } = options;

    const [retrievalResults, videos] = await Promise.all([
      retrieveContext(query),
      getVideosCatalog(),
    ]);

    const contextSection = formatContext(retrievalResults);
    const videoCatalog = formatVideosCatalog(videos);

    const recentMessages = conversationHistory.slice(-maxContextMessages);
    const messages: Anthropic.MessageParam[] = [
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: query },
    ];

    logger.info(
      {
        queryLength: query.length,
        historyLength: recentMessages.length,
        contextSections: retrievalResults.length,
        videosInCatalog: videos.length,
      },
      'Claude request',
    );

    const startTime = Date.now();

    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: 'text', text: baseSystemPrompt, cache_control: { type: 'ephemeral' } },
    ];
    if (contextSection) {
      systemBlocks.push({
        type: 'text',
        text: contextSection,
        cache_control: { type: 'ephemeral' },
      });
    }
    if (videoCatalog) {
      systemBlocks.push({
        type: 'text',
        text: videoCatalog,
        cache_control: { type: 'ephemeral' },
      });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [fixtureToolDefinition],
      system: systemBlocks,
      messages,
    });

    if (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(
        (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use',
      );

      if (toolUseBlock && toolUseBlock.name === 'generate_fixture') {
        const input = toolUseBlock.input as FixtureInput;

        logger.info({ category: input.category, teams: input.teams.length }, 'Generando fixture');

        const { text: fixtureText, tokensUsed: fixtureTokens } = await withDelayedMessage(
          () => generateFixtureWithClaude(input),
          onIntermediateMessage,
          'Armando el fixture, dame unos segundos... 🏉',
        );

        const latency = Date.now() - startTime;
        const tokensUsed =
          response.usage.input_tokens + response.usage.output_tokens + fixtureTokens;
        logger.info({ latencyMs: latency, tokensUsed }, 'Fixture generado');

        return { text: fixtureText, tokensUsed };
      }
    }

    const latency = Date.now() - startTime;
    const textContent = response.content.find((c): c is Anthropic.TextBlock => c.type === 'text');
    const rawText = textContent?.text ?? '';
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    // Parse optional [VIDEO:uuid] marker
    const videoMatch = rawText.match(VIDEO_MARKER_RE);
    const cleanText = videoMatch ? rawText.replace(videoMatch[0], '').trimEnd() : rawText;
    const videoId = videoMatch?.[1] ?? null;
    const videoRef = videoId ? videos.find((v) => v.id === videoId) : null;

    logger.info(
      {
        latencyMs: latency,
        inputTokens: response.usage.input_tokens,
        cacheCreationTokens: response.usage.cache_creation_input_tokens || 0,
        cacheReadTokens: response.usage.cache_read_input_tokens || 0,
        outputTokens: response.usage.output_tokens,
        videoId: videoId ?? undefined,
      },
      'Claude response',
    );

    return {
      text: cleanText,
      tokensUsed,
      ...(videoRef ? { video: { url: videoRef.url, title: videoRef.title } } : {}),
    };
  } catch (err) {
    logger.error(err, 'Claude API error');
    throw err;
  }
}
