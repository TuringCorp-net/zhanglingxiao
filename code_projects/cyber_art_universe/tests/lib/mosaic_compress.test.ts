/**
 * MosaicCompress Unit Tests (Zero LLM Cost)
 *
 * Tests the stateless compression logic by injecting mock LLM responses.
 * Run: npx tsx tests/lib/mosaic_compress.test.ts
 *
 * License: MIT
 */

import { mosaicCompress, DEFAULT_MOSAIC_CONFIG, type MosaicConfig } from '../../src/lib/l2/mosaic_compress';
import type { Message } from '../../src/lib/l0/aiGateway';

// ============================================================
// Test harness
// ============================================================

let PASS = 0;
let FAIL = 0;

function check(desc: string, condition: boolean, detail?: string): void {
  if (condition) { console.log(`  ✅ PASS: ${desc}`); PASS++; }
  else { console.log(`  ❌ FAIL: ${desc}${detail ? ` — ${detail}` : ''}`); FAIL++; }
}

function checkEq<T>(desc: string, actual: T, expected: T): void {
  if (actual === expected) { console.log(`  ✅ PASS: ${desc}`); PASS++; }
  else {
    console.log(`  ❌ FAIL: ${desc}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     got:      ${JSON.stringify(actual)}`);
    FAIL++;
  }
}

function section(title: string): void { console.log(`\n━━━ ${title} ━━━`); }

// Mock env — real callAI is never invoked when _mockCallAI is set
const mockEnv = { CF_AIG_TOKEN: 'mock' } as any;

// ============================================================
// Message builders
// ============================================================

function sys(c: string): Message { return { role: 'system', content: c }; }
function usr(c: string): Message { return { role: 'user', content: c }; }
function ast(c: string): Message { return { role: 'assistant', content: c }; }
function tool(c: string): Message { return { role: 'tool', content: c, tool_call_id: 't1' }; }

function astWithTool(name: string): Message {
  return { role: 'assistant', content: 'Let me check...', tool_calls: [{ id: 'x', type: 'function', function: { name, arguments: '{}' } }] };
}

/** Build an N-round mock conversation (alternating user/assistant) */
function makeConv(rounds: number, withSys = true): Message[] {
  const msgs: Message[] = [];
  if (withSys) msgs.push(sys('You are Story Elf, a creative writing companion.'));
  for (let i = 1; i <= rounds; i++) {
    msgs.push(usr(`Round ${i} user: Discussing worldbuilding and character arcs. Prefers fast-paced narrative.`));
    msgs.push(ast(`Round ${i} assistant: Confirmed soft magic system. Suggested fall-arc protagonist.`));
  }
  return msgs;
}

/** Count messages excluding the system prompt */
function countMsgs(msgs: Message[]): number {
  return msgs.filter(m => m.role !== 'system').length;
}

// ============================================================
// Mock LLM callbacks
// ============================================================

/** Light Compress mock: returns a distilled version for each message */
function mockLight(_sp: string, input: string): Promise<string> {
  const match = input.match(/compress the following (\d+) messages/);
  const n = match ? parseInt(match[1]) : 20;
  const items: { i: number; c: string }[] = [];
  for (let i = 0; i < n; i++) {
    const isUser = i % 2 === 0;
    items.push({ i, c: isUser ? '[compressed] User discussed creative topics' : '[compressed] Assistant gave suggestions' });
  }
  return Promise.resolve(JSON.stringify(items));
}

/** Light mock returning malformed JSON → triggers fallback */
function mockLightBad(_sp: string, _input: string): Promise<string> {
  return Promise.resolve('This is not valid JSON at all.');
}

/** Light mock throwing an error → triggers error handling */
function mockLightThrow(_sp: string, _input: string): Promise<string> {
  return Promise.reject(new Error('Simulated LLM failure'));
}

/** Heavy Compress mock: always returns a 2-message summary pair */
function mockHeavy(_sp: string, _input: string): Promise<string> {
  return Promise.resolve(JSON.stringify([
    { role: 'user', content: '[Summary] Discussed worldbuilding and character arcs. Decided on soft magic and fall-arc protagonist.' },
    { role: 'assistant', content: '[Confirmed] Directions recorded.' },
  ]));
}

// ============================================================
// Test cases
// ============================================================

async function run(): Promise<void> {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   MosaicCompress Unit Tests (Zero LLM)  ║');
  console.log('╚══════════════════════════════════════════╝');

  // ── 1. Below threshold ──
  section('1. Below threshold (R=20 < lightStart=30) → immediate return');
  {
    const msgs = makeConv(20);
    const res = await mosaicCompress(mockEnv, msgs);
    checkEq('Array unchanged', res.length, msgs.length);
    check('Content identical', JSON.stringify(res) === JSON.stringify(msgs));
  }

  // ── 2. Non-window round → no trigger ──
  section('2. Non-window round (R=33, 33%10≠0) → no compression');
  {
    const msgs = makeConv(33);
    const res = await mosaicCompress(mockEnv, msgs);
    checkEq('Array unchanged', res.length, msgs.length);
  }

  // ── 3. Light Compress at R=40 ──
  section('3. Light Compress (R=40, 40%10==0)');
  {
    const msgs = makeConv(40);
    const cfg: MosaicConfig = { ...DEFAULT_MOSAIC_CONFIG, _mockCallAI: mockLight };
    const res = await mosaicCompress(mockEnv, msgs, cfg);

    checkEq('System prompt preserved', res[0].content, msgs[0].content);
    // R=40: heavyEnd=-10→0, lightEnd=10. Light zone = rounds 1-10 (20 msgs distilled)
    // Heavy zone empty (R < heavyStart=50). Total unchanged: 80 history msgs.
    checkEq('Message count unchanged (Light only, count preserved)', countMsgs(res), 80);
    check('Light zone user message distilled', res[1].content!.includes('[compressed]'));
  }

  // ── 4. R=50: Light only, Heavy zone still empty ──
  section('4. R=50: Light triggers, Heavy zone empty (heavyEnd = 50-50 = 0)');
  {
    const msgs = makeConv(50);
    const cfg: MosaicConfig = {
      ...DEFAULT_MOSAIC_CONFIG,
      _mockCallAI: async (sp: string, inp: string) => {
        return inp.includes('compress the following') ? mockLight(sp, inp) : mockHeavy(sp, inp);
      },
    };
    const res = await mosaicCompress(mockEnv, msgs, cfg);

    // R=50: heavyEnd=0 → Heavy zone empty (no rounds before R-heavyStart)
    // Light zone = rounds 1-20 (lightEnd=20). Message count unchanged.
    checkEq('System prompt preserved', res[0].content, msgs[0].content);
    checkEq('Heavy zone empty, Light only, count unchanged', countMsgs(res), 100);
  }

  // ── 5. R=60: Heavy + Light both trigger ──
  section('5. R=60: Heavy zone has 10 rounds → 2 msgs, Light zone 20 rounds distilled');
  {
    const msgs = makeConv(60);
    const cfg: MosaicConfig = {
      ...DEFAULT_MOSAIC_CONFIG,
      _mockCallAI: async (sp: string, inp: string) => {
        return inp.includes('compress the following') ? mockLight(sp, inp) : mockHeavy(sp, inp);
      },
    };
    const res = await mosaicCompress(mockEnv, msgs, cfg);

    checkEq('System prompt preserved', res[0].content, msgs[0].content);
    // R=60: heavyEnd=10, lightEnd=30
    // Heavy zone = rounds 1-10 (20 msgs → 2), Light = rounds 11-30 (40 msgs distilled)
    // Raw = rounds 31-60 (60 msgs). Total: 2 + 40 + 60 = 102
    checkEq('Message count: 2(H) + 40(L) + 60(R) = 102', countMsgs(res), 102);
    check('Heavy pair: msg 1 is summary', res[1].content!.includes('Summary'));
    check('Heavy pair: msg 2 is confirmation', res[2].content!.includes('Confirmed'));
  }

  // ── 6. Steady state: same message count at different R ──
  section('6. Steady state — message count is constant regardless of R');
  {
    const cfg: MosaicConfig = {
      ...DEFAULT_MOSAIC_CONFIG,
      _mockCallAI: async (sp: string, inp: string) => {
        return inp.includes('compress the following') ? mockLight(sp, inp) : mockHeavy(sp, inp);
      },
    };

    // R=100: heavyEnd=50, lightEnd=70 → 2+40+60=102
    const res100 = await mosaicCompress(mockEnv, makeConv(100), cfg);
    checkEq('R=100: message count = 102', countMsgs(res100), 102);

    // R=200: heavyEnd=150, lightEnd=170 → 2+40+60=102
    const res200 = await mosaicCompress(mockEnv, makeConv(200), cfg);
    checkEq('R=200: message count = 102', countMsgs(res200), 102);

    checkEq('R=100 and R=200 have identical count', countMsgs(res100), countMsgs(res200));
  }

  // ── 7. System prompt preservation ──
  section('7. System prompt is never modified');
  {
    const longSys = 'Long system prompt. '.repeat(100);
    const msgs: Message[] = [sys(longSys), ...Array.from({ length: 80 }, (_, i) =>
      i % 2 === 0 ? usr(`Message ${i}`) : ast(`Reply ${i}`)
    )];
    const cfg: MosaicConfig = { ...DEFAULT_MOSAIC_CONFIG, _mockCallAI: mockLight };
    const res = await mosaicCompress(mockEnv, msgs, cfg);
    checkEq('System content unchanged', res[0].content, longSys);
    checkEq('System length unchanged', res[0].content!.length, longSys.length);
  }

  // ── 8. Input without system prompt ──
  section('8. Pure conversation (no system prompt)');
  {
    const msgs = makeConv(40, false);
    const cfg: MosaicConfig = { ...DEFAULT_MOSAIC_CONFIG, _mockCallAI: mockLight };
    const res = await mosaicCompress(mockEnv, msgs, cfg);
    check('No system role in result', res[0].role !== 'system');
    checkEq('Message count unchanged', res.length, msgs.length);
  }

  // ── 9. Tool calls don't break round counting ──
  section('9. Tool-call messages do not interfere with round counting');
  {
    const msgs: Message[] = [
      sys('S'), usr('Check the worldbuilding module'),
      astWithTool('read_module'), tool('{"m1":"..."}'),
      ast('Suggest soft magic.'), usr('Continue with characters'), ast('Fall-arc protagonist.'),
    ];
    // Only 2 user messages = 2 rounds, well below lightStart=30
    const res = await mosaicCompress(mockEnv, msgs);
    checkEq('Below threshold, array unchanged', res.length, msgs.length);
    checkEq('Tool messages preserved', res.filter(m => m.role === 'tool').length, 1);
  }

  // ── 10. Malformed JSON → fallback ──
  section('10. LLM returns malformed JSON → fallback, no crash');
  {
    const msgs = makeConv(40);
    const cfg: MosaicConfig = { ...DEFAULT_MOSAIC_CONFIG, _mockCallAI: mockLightBad };
    const res = await mosaicCompress(mockEnv, msgs, cfg);
    checkEq('Message count unchanged (fallback)', res.length, msgs.length);
  }

  // ── 11. LLM throws → graceful degradation ──
  section('11. LLM throws exception → returns originals, no crash');
  {
    const msgs = makeConv(40);
    const cfg: MosaicConfig = { ...DEFAULT_MOSAIC_CONFIG, _mockCallAI: mockLightThrow };
    const res = await mosaicCompress(mockEnv, msgs, cfg);
    checkEq('Message count unchanged (error fallback)', res.length, msgs.length);
  }

  // ── 12. Custom config ──
  section('12. Custom parameters (lightStart=10, lightWindow=5, heavyStart=20, heavyWindow=5)');
  {
    const cfg: MosaicConfig = { lightStart: 10, lightWindow: 5, heavyStart: 20, heavyWindow: 5, _mockCallAI: mockLight };
    const msgs = makeConv(15, false); // 15 rounds, 15%5==0 → Light triggers
    const res = await mosaicCompress(mockEnv, msgs, cfg);
    checkEq('Message count unchanged', res.length, msgs.length);
  }

  // ── 13. Heavy anti-jitter boundary ──
  section('13. R=50, heavyWindow=7 → Heavy does NOT trigger (50%7≠0)');
  {
    const cfg: MosaicConfig = { ...DEFAULT_MOSAIC_CONFIG, heavyWindow: 7, _mockCallAI: mockLight };
    const msgs = makeConv(50);
    const res = await mosaicCompress(mockEnv, msgs, cfg);
    // Light fires (50%10==0), Heavy does not (50%7≠0)
    checkEq('Only Light triggered, count unchanged', countMsgs(res), 100);
  }

  // ── 14. Role sequence preserved after Light Compress ──
  section('14. Light Compress preserves the role sequence');
  {
    const msgs = makeConv(40);
    const cfg: MosaicConfig = { ...DEFAULT_MOSAIC_CONFIG, _mockCallAI: mockLight };
    const res = await mosaicCompress(mockEnv, msgs, cfg);
    const expectedRoles = msgs.map(m => m.role);
    const actualRoles = res.map(m => m.role);
    checkEq('Role sequence identical', JSON.stringify(actualRoles), JSON.stringify(expectedRoles));
  }

  // ── 15. Bulk call: jump straight to R=200 ──
  section('15. Bulk call — R=200 in a single invocation');
  {
    const msgs = makeConv(200);
    const cfg: MosaicConfig = {
      ...DEFAULT_MOSAIC_CONFIG,
      _mockCallAI: async (sp: string, inp: string) => {
        return inp.includes('compress the following') ? mockLight(sp, inp) : mockHeavy(sp, inp);
      },
    };
    const res = await mosaicCompress(mockEnv, msgs, cfg);
    // R=200: heavyEnd=150, lightEnd=170
    // Heavy: 150 rounds (300 msgs → 2), Light: 20 rounds (40 msgs distilled)
    // Raw: 30 rounds (60 msgs). Total: 2 + 40 + 60 = 102
    checkEq('Message count: 2+40+60 = 102', countMsgs(res), 102);
    check('Heavy summary present', res[1].content!.includes('Summary'));
  }

  // ── Summary ──
  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Total: ${PASS + FAIL}  |  ✅ PASS: ${PASS}  |  ❌ FAIL: ${FAIL}`);
  console.log(`══════════════════════════════════════════`);
  if (FAIL > 0) (globalThis as any).process?.exit?.(1);
}

run().catch(err => { console.error(err); (globalThis as any).process?.exit?.(1); });
