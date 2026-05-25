// AI 调用模块 — 向后兼容 re-export
// 实际实现在 l0/aiGateway.ts，此处仅 re-export 以保持现有 import 路径不变。

export { callAI, generateWithAI, isAIAvailable, AIError, type Message, type AICallOptions, type AICallResult, type AIOptions } from './l0/aiGateway';
