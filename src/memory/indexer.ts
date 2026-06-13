import type { ReasoningState, MemoryEntry } from '../core/types.js';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'were',
  'been', 'are', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'not',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'its', 'our', 'their', 'what', 'which', 'who', 'whom', 'how',
  'when', 'where', 'why', 'if', 'then', 'than', 'so', 'no', 'up',
  'out', 'about', 'into', 'over', 'after', 'just', 'also', 'very',
]);

export function extractTags(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_,.;:!?()[\]{}'"\/\\]+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

export function extractMemoryFromState(state: ReasoningState, embedding: number[]): MemoryEntry {
  const claims = state.claims
    .filter(c => c.confidence >= 0.7)
    .map(c => c.content);

  const lessons = state.assumptions
    .filter(a => a.status === 'challenged' || a.status === 'refuted')
    .map(a => `Assumption "${a.content}" was ${a.status}`);

  const tags = extractTags(state.goal);

  return {
    id: `mem-${state.id}-${Date.now()}`,
    sessionId: state.id,
    goal: state.goal,
    claims,
    lessons,
    embedding,
    timestamp: Date.now(),
    tags,
  };
}
