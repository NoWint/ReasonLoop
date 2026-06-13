import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Header } from './header.js';
import { ReasoningDisplay } from './reasoning.js';
import type { ReasoningEvent, RoleState, ViewRoleState } from './reasoning.js';
import { InputArea } from './input.js';

export type { ReasoningEvent };
export type { RoleState, ViewRoleState };

export interface ChatState {
  provider: string;
  model: string;
  multiView: boolean;
  maxIterations: number;
  budget: number;
  currentIteration: number;
  stability: number;
  usedBudget: number;
  isReasoning: boolean;
  events: ReasoningEvent[];
  serveMode: boolean;
  // Structured role states for panel display
  roles: {
    scratchpad: RoleState;
    planner: RoleState;
    critic: RoleState;
    adversary: RoleState;
  };
  views: ViewRoleState[];
  synthesis: { content: string; duration?: number } | null;
  iterationInfo: string;
  finalAnswer: string;
}

interface AppProps {
  state: ChatState;
  onSendMessage: (message: string) => void;
}

export const App: React.FC<AppProps> = ({ state, onSendMessage }) => {
  const { exit } = useApp();
  const [input, setInput] = useState('');

  const handleSubmit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/')) {
      const [cmd, ...args] = trimmed.slice(1).split(' ');
      switch (cmd) {
        case 'exit':
        case 'quit':
          exit();
          break;
        case 'clear':
          onSendMessage('/clear');
          break;
        case 'multi-view':
          onSendMessage('/multi-view');
          break;
        case 'config':
          onSendMessage('/config');
          break;
        case 'model':
          onSendMessage(`/model ${args[0] ?? ''}`);
          break;
        case 'max-iter':
          onSendMessage(`/max-iter ${args[0] ?? ''}`);
          break;
        case 'budget':
          onSendMessage(`/budget ${args[0] ?? ''}`);
          break;
        case 'serve':
          onSendMessage('/serve');
          break;
        case 'help':
          onSendMessage('/help');
          break;
        default:
          onSendMessage(`/unknown ${cmd}`);
      }
      setInput('');
      return;
    }

    onSendMessage(trimmed);
    setInput('');
  }, [exit, onSendMessage]);

  return (
    <Box flexDirection="column" height="100%">
      <Header
        provider={state.provider}
        model={state.model}
        multiView={state.multiView}
        iteration={state.currentIteration}
        maxIterations={state.maxIterations}
        stability={state.stability}
        budget={state.usedBudget}
        budgetLimit={state.budget}
        serveMode={state.serveMode}
      />
      <ReasoningDisplay
        events={state.events}
        isReasoning={state.isReasoning}
        roles={state.roles}
        views={state.views}
        synthesis={state.synthesis}
        iterationInfo={state.iterationInfo}
        finalAnswer={state.finalAnswer}
      />
      <InputArea
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={state.isReasoning}
      />
    </Box>
  );
};
