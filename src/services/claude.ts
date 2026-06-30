import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger.js';
import { retrieveContext, formatContext } from './retrieval.js';
import { buildFixtureUserMessage, FIXTURE_SPEC } from '../lib/fixture.js';
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

export interface ChatOptions {
  conversationHistory?: Message[];
  maxContextMessages?: number;
  onIntermediateMessage?: (text: string) => Promise<void>;
}

async function generateFixtureWithClaude(input: FixtureInput): Promise<string> {
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

  // Solo devolver los bloques de texto — los bloques de thinking quedan ocultos
  const text = response.content.find((c): c is Anthropic.TextBlock => c.type === 'text');
  return text?.text ?? 'No se pudo generar el fixture.';
}

export async function chat(query: string, options: ChatOptions = {}): Promise<string> {
  try {
    const { conversationHistory = [], maxContextMessages = 30, onIntermediateMessage } = options;

    const retrievalResults = await retrieveContext(query);
    const contextSection = formatContext(retrievalResults);

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
      },
      'Claude request',
    );

    if (onIntermediateMessage) {
      await onIntermediateMessage('Dame un segundo... 🏉');
    }

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

        const fixtureText = await generateFixtureWithClaude(input);

        const latency = Date.now() - startTime;
        logger.info({ latencyMs: latency }, 'Fixture generado');

        return fixtureText;
      }
    }

    const latency = Date.now() - startTime;
    const textContent = response.content.find((c): c is Anthropic.TextBlock => c.type === 'text');
    const responseText = textContent?.text ?? '';

    logger.info(
      {
        latencyMs: latency,
        inputTokens: response.usage.input_tokens,
        cacheCreationTokens: response.usage.cache_creation_input_tokens || 0,
        cacheReadTokens: response.usage.cache_read_input_tokens || 0,
        outputTokens: response.usage.output_tokens,
      },
      'Claude response',
    );

    return responseText;
  } catch (err) {
    logger.error(err, 'Claude API error');
    throw err;
  }
}
