import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger.js';
import { retrieveContext, formatContext } from './retrieval.js';
import { generateFixture, formatFixture } from '../lib/fixture.js';
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
    'Genera el fixture de partidos para una jornada. Llamá esta herramienta cuando tengas toda la información necesaria: canchas disponibles, equipos con su categoría (competitivo/formativo), máximo de partidos y si es mixto o separado.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Categoría de los equipos (M6, M8, M10, M12 o M14)',
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
            name: { type: 'string', description: 'Nombre del club' },
            type: {
              type: 'string',
              enum: ['competitivo', 'formativo'],
              description: 'Categoría del equipo',
            },
          },
          required: ['name', 'type'],
        },
        description: 'Lista de equipos participantes',
      },
      max_matches: {
        type: 'number',
        description: 'Número máximo de partidos en la jornada',
      },
      mixed: {
        type: 'boolean',
        description: 'Si es true, competitivos pueden jugar contra formativos. Por defecto false.',
      },
    },
    required: ['category', 'courts', 'teams', 'max_matches'],
  },
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  conversationHistory?: Message[];
  maxContextMessages?: number;
}

export async function chat(query: string, options: ChatOptions = {}): Promise<string> {
  try {
    const { conversationHistory = [], maxContextMessages = 10 } = options;

    const retrievalResults = await retrieveContext(query);
    const contextSection = formatContext(retrievalResults);
    const systemPrompt = `${baseSystemPrompt}\n\n${contextSection}`;

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

    const startTime = Date.now();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [fixtureToolDefinition],
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    // Handle tool_use for fixture generation
    if (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(
        (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use',
      );

      if (toolUseBlock && toolUseBlock.name === 'generate_fixture') {
        const input = toolUseBlock.input as FixtureInput;
        const fixtureOutput = generateFixture(input);
        const fixtureText = formatFixture(fixtureOutput);

        logger.info({ category: input.category, teams: input.teams.length }, 'Fixture generado');

        const followUpMessages: Anthropic.MessageParam[] = [
          ...messages,
          { role: 'assistant', content: response.content },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: fixtureText,
              },
            ],
          },
        ];

        const finalResponse = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          tools: [fixtureToolDefinition],
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: followUpMessages,
        });

        const finalText = finalResponse.content.find(
          (c): c is Anthropic.TextBlock => c.type === 'text',
        );

        const latency = Date.now() - startTime;
        logger.info(
          {
            latencyMs: latency,
            inputTokens: finalResponse.usage.input_tokens,
            outputTokens: finalResponse.usage.output_tokens,
          },
          'Claude response (fixture)',
        );

        return finalText?.text ?? fixtureText;
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
