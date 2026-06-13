import type { ProxyRequest, ComplexityAnalysis } from './types.js';

export function analyzeComplexity(request: ProxyRequest, threshold: number = 0.5): ComplexityAnalysis {
  const lastMessage = request.messages[request.messages.length - 1]?.content ?? '';
  const totalLength = request.messages.reduce((sum, m) => sum + m.content.length, 0);

  let score = 0;

  // Length factor (0-0.2)
  score += Math.min(totalLength / 3000, 1) * 0.2;

  // Keyword factor (0-0.5)
  const complexKeywords = [
    '设计', '架构', '分析', '比较', '评估', '方案', '实现', '取舍', '权衡', '决策', '优化', '重构',
    '设计', '实现', '方案', '分析', '评估', '比较', '取舍', '权衡', '讨论', '深入', '详细', '解释',
    '原因', '影响', '风险', '挑战', '策略', '原则', '模式', '最佳实践', '利弊', '优缺点',
    'design', 'architect', 'analyze', 'compare', 'evaluate', 'implement', 'solution', 'tradeoff', 'trade-off', 'optimize',
    'refactor', 'discuss', 'explain', 'reason', 'impact', 'risk', 'challenge', 'strategy', 'principle', 'pattern',
    'best practice', 'pros and cons', 'advantage', 'disadvantage', 'consider', 'recommend',
  ];
  const keywordHits = complexKeywords.filter(kw => lastMessage.toLowerCase().includes(kw)).length;
  score += Math.min(keywordHits * 0.15, 0.5);

  // Question pattern factor (0-0.3)
  if (/^(how|why|what|which|是否|如何|为什么|哪个|怎样|怎么)/i.test(lastMessage.trim())) score += 0.1;
  if (/设计|实现|方案|分析|评估|比较|取舍|权衡|讨论|深入|详细|解释|原因|影响|风险|挑战|策略|原则|模式|利弊|优缺点|design|implement|solution|analyze|evaluate|compare|discuss|explain|recommend|consider/i.test(lastMessage)) score += 0.2;

  // Multi-sentence factor (0-0.1) - longer, multi-part questions tend to be complex
  const sentences = lastMessage.split(/[。？！；.?!;]/).filter(s => s.trim().length > 0);
  if (sentences.length >= 3) score += 0.1;

  score = Math.min(score, 1);

  return {
    score,
    shouldLoop: score >= threshold,
    reasoning: `Complexity ${score.toFixed(2)} ${score >= threshold ? '>=' : '<'} threshold ${threshold}`,
  };
}
