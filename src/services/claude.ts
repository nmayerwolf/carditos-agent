import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger.js';
import { retrieveContext, formatContext } from './retrieval.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Load system prompt
const systemPromptPath = path.join(__dirname, '../prompts/system-carditos.md');
const baseSystemPrompt = fs.readFileSync(systemPromptPath, 'utf-8');

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

    // Retrieve relevant corpus context
    const retrievalResults = await retrieveContext(query);
    const contextSection = formatContext(retrievalResults);

    // Build system prompt with context
    const systemPrompt = `${baseSystemPrompt}\n\n${contextSection}`;

    // Build messages (keep last N messages for context)
    const recentMessages = conversationHistory.slice(-maxContextMessages);
    const messages: Message[] = [
      ...recentMessages,
      {
        role: 'user',
        content: query,
      },
    ];

    logger.info(
      {
        queryLength: query.length,
        historyLength: recentMessages.length,
        contextSections: retrievalResults.length,
      },
      'Claude request',
    );

    // Call Claude with prompt caching
    const startTime = Date.now();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const latency = Date.now() - startTime;

    // Extract response
    const textContent = response.content.find((c) => c.type === 'text');
    const responseText = textContent && 'text' in textContent ? textContent.text : '';

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
