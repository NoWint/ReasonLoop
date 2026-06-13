import type { ReasoningView } from './types.js';

export const BUILT_IN_VIEWS: ReasoningView[] = [
  {
    id: 'architect',
    name: 'Architect',
    systemPrompt: 'You are a system architect. Focus on overall design, modularity, extensibility, and architectural patterns. Evaluate trade-offs between simplicity and flexibility.',
    focusAreas: ['architecture', 'modularity', 'extensibility', 'design patterns', 'trade-offs'],
    weight: 1.0,
  },
  {
    id: 'security-engineer',
    name: 'Security Engineer',
    systemPrompt: 'You are a security engineer. Focus on threat modeling, attack surfaces, authentication, authorization, data protection, and security best practices.',
    focusAreas: ['security', 'threat modeling', 'authentication', 'authorization', 'data protection'],
    weight: 0.9,
  },
  {
    id: 'devops',
    name: 'DevOps',
    systemPrompt: 'You are a DevOps engineer. Focus on deployment, scalability, monitoring, reliability, operational simplicity, and infrastructure concerns.',
    focusAreas: ['deployment', 'scalability', 'monitoring', 'reliability', 'operations'],
    weight: 0.8,
  },
  {
    id: 'pragmatist',
    name: 'Pragmatist',
    systemPrompt: 'You are a pragmatic engineer. Focus on simplicity, time-to-market, practical trade-offs, and avoiding over-engineering. Challenge unnecessary complexity.',
    focusAreas: ['simplicity', 'time-to-market', 'practical trade-offs', 'avoiding over-engineering', 'MVP scope'],
    weight: 0.7,
  },
];

export function getViewById(id: string): ReasoningView | undefined {
  return BUILT_IN_VIEWS.find(v => v.id === id);
}
