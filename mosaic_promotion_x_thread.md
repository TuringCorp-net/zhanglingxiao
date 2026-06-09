1/ LLM conversations grow forever. Context windows don't.

We built a stateless compressor that simulates human forgetting — keeping your AI chat bounded at 82 messages, forever.

2/ Three zones:

• Recent 30 rounds → verbatim
• Next 20 rounds → distilled (count preserved)
• Everything older → recursively merged into 2 summary messages

From round 60 to round 15,000: always 82 messages. Always ~33.7K tokens.

3/ Anti-jitter: compression fires every 10 rounds, not every turn. LLM-agnostic: bring your own provider. Graceful degradation: if LLM fails, conversation continues.

~200 lines of TypeScript. Zero deps. MIT.

4/ The best UX for "infinite conversation" is one where the user never knows a "Session" exists.

npm install mosaic-compress
🔗 github.com/TuringCorp-net/mosaic_compress

#LLM #OpenSource #AIEngineering #ContextWindow
