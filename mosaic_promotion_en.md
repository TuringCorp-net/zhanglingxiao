# MosaicCompress: Your AI Conversations, Forever Bounded

> A ~200-line open-source library solves one of LLM's hardest problems — context window overflow.

---

## The Problem

Every message in an LLM conversation gets fed back into the context window. At round 10, that's fine. At round 1,000, you're asking the model to re-read a small novel before answering each question. At round 15,000? Forget about it.

This is the dirty secret of every "long conversation" with AI: **context windows have hard limits, and human conversations don't.**

Existing solutions fall into three camps:

1. **Session management** — "Start a new chat." This forces users to manually fragment their own thinking into arbitrary chunks.
2. **Sliding window truncation** — Keep the last N turns, dump everything before. Simple, but you lose the beginning of the story.
3. **Summary compression** — Condense all history into one blob. Preserves key facts, but destroys dialogue structure, causal chains, and conversational rhythm.

All three share a common flaw: **they require the user to understand and manage "sessions."** For non-technical users — writers, creators, students — this is unnecessary cognitive friction.

---

## The Insight: Forget Like a Human

The human brain doesn't remember everything or nothing. Recent events are crystal clear; older ones get fuzzy; ancient ones leave only impressions — unless they were truly important.

**MosaicCompress**, a new open-source library from TuringCorp, brings this gradient to AI conversations. It arranges dialogue history into three zones:

```
Heavy zone (ancient)  → 2 summary messages (recursive merge)
Light zone (recent-ish) → each round distilled, count preserved
Raw zone  (recent)    → kept verbatim
```

### How it works

- **Raw zone** — The most recent 30 rounds. Not compressed at all, because the user is most likely to reference these right now.
- **Light zone** — Rounds 31–50. Each message gets "de-watered": filler words removed, essential content distilled. But the conversation structure — role alternation, message count, causal ordering — stays intact.
- **Heavy zone** — Everything before round 51. Recursively merged into exactly 2 messages: one user summary, one assistant confirmation.

The magic: **from round 60 onward, the message count is constant at 82.** Whether the conversation reaches round 100, 5,000, or 15,000 — 82 messages. Context never overflows.

Compression ratio approaches **99.8%** for long conversations.

---

## Three Design Decisions That Make It Work

### 1. Anti-jitter

LLM-based compression takes 1-2 seconds. If every turn required compression, the experience would be terrible.

So MosaicCompress only fires at configurable window boundaries — default: **every 10 rounds**. Most turns are instant. Users feel a brief delay only once every ~10 exchanges.

### 2. Recursive Merge (the Heavy Zone)

The 2-message summary in the Heavy zone isn't fixed. Every 10 rounds, it's merged with newly compressed data and re-compressed — still into 2 messages.

This means the Heavy zone **never grows**. One block, two messages, infinite scope expansion. Like a well-maintained notebook where old notes are synthesized into new ones rather than piling up.

### 3. Graceful Degradation

What if the LLM call fails (network error, timeout, bad output)?

MosaicCompress returns the original messages unchanged. **The conversation never blocks on compression.** Failure is logged, skipped, and retried at the next window boundary.

---

## Stats That Matter

| Rounds | Uncompressed | Compressed | Reduction |
|--------|-------------|-----------|-----------|
| 100 | 100K tokens | 33.7K | 66% |
| 500 | 500K tokens | 33.7K | 93% |
| 5,000 | 5M tokens | 33.7K | 99.3% |
| 15,000 | 15M tokens | 33.7K | 99.8% |

From round 60 onward, compressed size is **completely flat**. The longer the conversation, the more dramatic the savings.

---

## Where It Fits

MosaicCompress is **orthogonal to** persistent memory systems (profiles, vector databases, cross-session memory). They complement each other:

| | Persistent Memory | MosaicCompress |
|--|-----------------|----------------|
| What | Extracts "who the user is" | Manages "what we're talking about" |
| Output | Memory profile → system prompt | Compressed blocks → messages array |
| Lifetime | Cross-session, permanent | Within current conversation |
| Trigger | Cron / conditional | Round threshold |

---

## Technical Footprint

**~200 lines of TypeScript.** One file (`src/index.ts`). Zero runtime dependencies. MIT licensed.

Stateless, idempotent, zero-cost below threshold. Same input always produces same output — regardless of call history.

The API is minimal:

```typescript
const compressed = await mosaicCompress(messages, {
  lightStart: 30,
  lightWindow: 10,
  heavyStart: 50,
  heavyWindow: 10,
  callLLM: yourLLMFunction,
});
```

You bring your own LLM provider — OpenAI, Anthropic, DeepSeek, local models, anything. MosaicCompress is provider-agnostic.

---

## Why It Matters Now

2025–2026 is the era of AI **agents** — autonomous systems that execute multi-step, multi-day tasks. Agents inherently need long conversations. If an agent "forgets" at round 50, it can't complete cross-day workflows.

MosaicCompress provides a stable, bounded context window that lets agents — and their human users — keep going indefinitely. No Session. No overflow. No interruption.

The best technology is invisible. MosaicCompress makes the concept of "session" invisible.

---

**GitHub:** [github.com/TuringCorp-net/mosaic_compress](https://github.com/TuringCorp-net/mosaic_compress)
**npm:** `npm install mosaic-compress`
**License:** MIT

*Built by TuringCorp. First open-source release, June 2026.*
