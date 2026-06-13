import type { ProxyRequest, ComplexityAnalysis } from './types.js';

export function analyzeComplexity(request: ProxyRequest, threshold: number = 0.5): ComplexityAnalysis {
  const lastMessage = request.messages[request.messages.length - 1]?.content ?? '';
  const totalLength = request.messages.reduce((sum, m) => sum + m.content.length, 0);

  let score = 0;

  // Length factor (0-0.3)
  score += Math.min(totalLength / 5000, 1) * 0.3;

  // Keyword factor (0-0.4)
  const complexKeywords = [
    '设计', '架构', '分析', '比较', '评估', '方案', '实现',
    'design', 'architect', 'analyze', 'compare', 'evaluate', 'implement', 'solution',
  ];
  if (complexKeywords.some(kw => lastMessage.toLowerCase().includes(kw))) score += 0.4;

  // Question pattern factor (0-0.3)
  if (/^(how|why|what|which|是否|如何|为什么|哪个)/i.test(lastMessage.trim())) score += 0.15;
  if (/设计|实现|方案|design|implement|solution|analyze/i.test(lastMessage)) score += 0.15;

  score = Math.min(score, 1);

  return {
    score,
    shouldLoop: score >= threshold,
    reasoning: `Complexity ${score.toFixed(2)} ${score >= threshold ? '>=' : '<'} threshold ${threshold}`,
  };
}
