// MosaicCompress — Stateless dialogue compression based on natural forgetting curve
// Design doc: docs/story_elf/mosaic_compress.md
//
// A pure function: given a message array, partitions it into three zones by round position:
//   Heavy zone (rounds before R - heavyStart) → compress ALL into 2 messages
//   Light zone (between heavyStart and lightStart) → distill each message, count unchanged
//   Raw zone  (most recent lightStart rounds)   → keep as-is
// lightWindow / heavyWindow serve as anti-jitter: compression only fires at window boundaries.

import { Env } from '../../db/schema';
import compressPrompt from './prompts/mosaic_compress/system.md';
import pairPrompt from './prompts/mosaic_pair/system.md';
import { callAI, type Message } from '../l0/aiGateway';

// ============================================================
// Types
// ============================================================

export interface MosaicConfig {
  /** Number of most recent rounds to keep raw (no compression). Default 30 */
  lightStart: number;
  /** Anti-jitter window for Light Compress (trigger every N rounds). Default 10 */
  lightWindow: number;
  /** Rounds beyond this become Heavy zone. Must be > lightStart. Default 50 */
  heavyStart: number;
  /** Anti-jitter window for Heavy Compress. Should match lightWindow. Default 10 */
  heavyWindow: number;
  /** Model used for compression. Default 'deepseek-v4-flash' */
  model?: string;
  /** @internal Test hook: mock LLM response, bypasses real callAI */
  _mockCallAI?: (systemPrompt: string, userInput: string) => Promise<string>;
}

export const DEFAULT_MOSAIC_CONFIG: MosaicConfig = {
  lightStart: 30,
  lightWindow: 10,
  heavyStart: 50,
  heavyWindow: 10,
  model: 'deepseek-v4-flash',
};

// ============================================================
// Main entry point
// ============================================================

/**
 * MosaicCompress — stateless dialogue compression.
 *
 * - Below lightStart rounds → zero-cost, returns immediately
 * - At window boundaries → Light Compress on Light zone, Heavy Compress on Heavy zone
 * - Idempotent: same input always yields same output regardless of call history
 *
 * @param env      - Workers environment for LLM calls
 * @param messages - Full message array (system prompt at [0] if present)
 * @param config   - Compression config
 */
export async function mosaicCompress(
  env: Env,
  messages: Message[],
  config: MosaicConfig = DEFAULT_MOSAIC_CONFIG,
): Promise<Message[]> {
  // Separate system prompt from conversation history
  const hasSystem = messages.length > 0 && messages[0].role === 'system';
  const sysMsg = hasSystem ? [messages[0]] : [];
  const history = hasSystem ? messages.slice(1) : messages;

  // Count rounds — each user message starts a new round
  const roundStarts = findRoundStarts(history);
  const R = roundStarts.length;

  // Below threshold → return immediately (zero cost)
  if (R < config.lightStart) return messages;

  // Anti-jitter: only compress at window boundaries
  const needLight = R % config.lightWindow === 0;
  const needHeavy = R >= config.heavyStart && R % config.heavyWindow === 0;

  if (!needLight && !needHeavy) return messages;

  // Compute three-zone boundaries (in user-message indices, 0-based)
  const heavyEnd = R - config.heavyStart;     // Heavy zone end (exclusive), also Light zone start
  const lightEnd = R - config.lightStart;      // Light zone end (exclusive), also Raw zone start

  let result = [...history];

  // Light first (message count unchanged), then Heavy (count changes, but boundaries are precomputed)
  if (needLight && lightEnd > 0) {
    result = await applyLightCompress(env, result, roundStarts, heavyEnd, lightEnd, config);
  }

  if (needHeavy && heavyEnd > 0) {
    result = await applyHeavyCompress(env, result, roundStarts, heavyEnd, config);
  }

  return [...sysMsg, ...result];
}

// ============================================================
// Round counting
// ============================================================

/** Find the physical index of each user message in the history array */
function findRoundStarts(history: Message[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < history.length; i++) {
    if (history[i].role === 'user') starts.push(i);
  }
  return starts;
}

// ============================================================
// Light Compress — distill each message, count unchanged
// ============================================================

/**
 * Light Compress: distill messages in the Light zone.
 * Each message is shortened independently; roles, order, and count are preserved.
 *
 * @param heavyEnd - Heavy zone end (0-based user index), where Light zone begins
 * @param lightEnd - Light zone end (0-based user index), where Raw zone begins
 */
async function applyLightCompress(
  env: Env,
  history: Message[],
  roundStarts: number[],
  heavyEnd: number,
  lightEnd: number,
  config: MosaicConfig,
): Promise<Message[]> {
  const startIdx = heavyEnd > 0 ? roundStarts[heavyEnd] : 0;
  const endIdx = lightEnd < roundStarts.length ? roundStarts[lightEnd] : history.length;

  if (startIdx >= endIdx) return history;

  const target = history.slice(startIdx, endIdx);
  const compressed = await runLightCompressLLM(env, target, config);

  const result = [...history];
  result.splice(startIdx, endIdx - startIdx, ...compressed);
  return result;
}

/** Call the LLM to distill each message individually */
async function runLightCompressLLM(
  env: Env,
  messages: Message[],
  config: MosaicConfig,
): Promise<Message[]> {
  // Build input: numbered messages with role labels
  const msgLines = messages.map((m, i) => {
    const content = m.content || '';
    const roleLabel = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : m.role;
    return `[${i}] ${roleLabel}: ${content}`;
  }).join('\n\n');

  try {
    let content: string;
    if (config._mockCallAI) {
      content = await config._mockCallAI(compressPrompt, `Please compress the following ${messages.length} messages:\n\n${msgLines}`);
    } else {
      const result = await callAI(env, [
        { role: 'system', content: compressPrompt },
        { role: 'user', content: `Please compress the following ${messages.length} messages:\n\n${msgLines}` },
      ], { model: config.model || 'deepseek-v4-flash', maxTokens: 2048, temperature: 0.3 });
      content = result.content || '';
    }
    return parseLightResult(content, messages);
  } catch (err) {
    console.error('[mosaic_compress] Light Compress LLM call failed:', (err as Error).message);
    return messages; // On failure, return originals — don't block the conversation
  }
}

/** Parse Light Compress LLM output back to Message[] */
function parseLightResult(raw: string, original: Message[]): Message[] {
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return original;
    const items: { i: number; c: string }[] = JSON.parse(m[0]);
    const map = new Map<number, string>();
    for (const item of items) map.set(item.i, item.c);
    return original.map((msg, i) => {
      const c = map.get(i);
      // 压缩失败 → 保留原文，下次压缩时可能成功
      return c && c.length > 0 ? { ...msg, content: c } : msg;
    });
  } catch {
    return original; // Parse error → fall back to originals
  }
}

// ============================================================
// Heavy Compress — entire Heavy zone → 2 messages
// ============================================================

/**
 * Heavy Compress: compress the entire Heavy zone into exactly 2 messages
 * (1 user summary + 1 assistant confirmation).
 *
 * @param heavyEnd - Heavy zone end (0-based user index), exclusive
 */
async function applyHeavyCompress(
  env: Env,
  history: Message[],
  roundStarts: number[],
  heavyEnd: number,
  config: MosaicConfig,
): Promise<Message[]> {
  const endIdx = heavyEnd < roundStarts.length ? roundStarts[heavyEnd] : history.length;
  const target = history.slice(0, endIdx);

  if (target.length === 0) return history;

  const pair = await runHeavyCompressLLM(env, target, config);

  // Replace entire Heavy zone with the 2-message pair
  const result = [...history];
  result.splice(0, endIdx, ...pair);
  return result;
}

/** Call the LLM to compress messages into a summary pair */
async function runHeavyCompressLLM(
  env: Env,
  messages: Message[],
  config: MosaicConfig,
): Promise<Message[]> {
  const inputText = messages.map((m, i) => {
    const roleLabel = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : m.role;
    return `[${i}] ${roleLabel}: ${m.content || ''}`;
  }).join('\n\n');

  try {
    let content: string;
    if (config._mockCallAI) {
      content = await config._mockCallAI(pairPrompt, inputText);
    } else {
      const result = await callAI(env, [
        { role: 'system', content: pairPrompt },
        { role: 'user', content: inputText },
      ], { model: config.model || 'deepseek-v4-flash', maxTokens: 2048, temperature: 0.3 });
      content = result.content || '';
    }
    return parseHeavyResult(content);
  } catch (err) {
    console.error('[mosaic_compress] Heavy Compress LLM call failed:', (err as Error).message);
    return [
      { role: 'user', content: '[Compression failed] Conversation continues.' },
      { role: 'assistant', content: '[Acknowledged] Issue does not affect the conversation.' },
    ];
  }
}

/** Parse Heavy Compress LLM output */
function parseHeavyResult(raw: string): Message[] {
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('No JSON array found');
    const items: { role: string; content: string }[] = JSON.parse(m[0]);
    return items.slice(0, 2).map(item => ({
      role: item.role as 'user' | 'assistant',
      content: item.content || '',
    }));
  } catch {
    return [
      { role: 'user', content: '[Compression failed] Summary unavailable.' },
      { role: 'assistant', content: '[Acknowledged] Conversation can continue.' },
    ];
  }
}
