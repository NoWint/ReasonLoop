import React from 'react';
import { Box, Text } from 'ink';

export interface ReasoningEvent {
  type: 'scratchpad' | 'planner' | 'critic' | 'adversary' | 'view' | 'synthesis' | 'system' | 'final' | 'error';
  role?: string;
  content: string;
  duration?: number;
  meta?: Record<string, unknown>;
}

// Role panel state - tracks what each role is doing
export interface RoleState {
  status: 'idle' | 'thinking' | 'done';
  content: string;
  duration?: number;
}

export interface ViewRoleState {
  name: string;
  color: string;
  status: 'idle' | 'thinking' | 'done';
  content: string;
  duration?: number;
}

interface ReasoningDisplayProps {
  events: ReasoningEvent[];
  isReasoning: boolean;
  roles?: {
    scratchpad: RoleState;
    planner: RoleState;
    critic: RoleState;
    adversary: RoleState;
  };
  views?: ViewRoleState[];
  synthesis?: { content: string; duration?: number } | null;
  iterationInfo?: string;
  finalAnswer?: string;
}

const VIEW_COLORS: Record<string, string> = {
  Architect: 'blue',
  'Security Engineer': 'magenta',
  DevOps: 'green',
  Pragmatist: 'yellow',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const RolePanel: React.FC<{
  label: string;
  color: string;
  state: RoleState;
}> = ({ label, color, state }) => {
  const durationStr = state.duration != null ? ` ${formatDuration(state.duration)}` : '';

  return (
    <Box flexDirection="column" width="50%" paddingX={1}>
      <Box>
        <Text color={color} bold>[{label}]</Text>
        {state.status === 'thinking' && <Text color="cyan"> thinking...</Text>}
        {state.status === 'done' && <Text color="green"> done{durationStr}</Text>}
        {state.status === 'idle' && <Text color="gray"> --</Text>}
      </Box>
      {state.status === 'thinking' && (
        <Text color="gray">{state.content || '|'}</Text>
      )}
      {state.status === 'done' && state.content && (
        <Text>{state.content}</Text>
      )}
    </Box>
  );
};

const ViewPanel: React.FC<{
  view: ViewRoleState;
}> = ({ view }) => {
  const durationStr = view.duration != null ? ` ${formatDuration(view.duration)}` : '';

  return (
    <Box flexDirection="column" width="50%" paddingX={1}>
      <Box>
        <Text color={view.color} bold>[{view.name}]</Text>
        {view.status === 'thinking' && <Text color="cyan"> thinking...</Text>}
        {view.status === 'done' && <Text color="green"> done{durationStr}</Text>}
        {view.status === 'idle' && <Text color="gray"> --</Text>}
      </Box>
      {view.status === 'thinking' && (
        <Text color="gray">{view.content || '|'}</Text>
      )}
      {view.status === 'done' && view.content && (
        <Text>{view.content}</Text>
      )}
    </Box>
  );
};

export const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
  events,
  isReasoning,
  roles,
  views,
  synthesis,
  iterationInfo,
  finalAnswer,
}) => {
  // If we have structured role states, use panel layout
  if (roles) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        {/* Top row: Scratchpad + Planner */}
        <Box flexDirection="row">
          <RolePanel label="SCRATCHPAD" color="gray" state={roles.scratchpad} />
          <RolePanel label="PLANNER" color="cyan" state={roles.planner} />
        </Box>

        {/* Bottom row: Critic + Adversary */}
        <Box flexDirection="row">
          <RolePanel label="CRITIC" color="yellow" state={roles.critic} />
          <RolePanel label="ADVERSARY" color="red" state={roles.adversary} />
        </Box>

        {/* Multi-view panels */}
        {views && views.length > 0 && (
          <Box flexDirection="column">
            <Text color="white" bold>-- Multi-View --</Text>
            <Box flexDirection="row" flexWrap="wrap">
              {views.map((v, i) => (
                <ViewPanel key={i} view={v} />
              ))}
            </Box>
            {synthesis && (
              <Box flexDirection="column" paddingX={1}>
                <Text bold>[SYNTHESIS]</Text>
                <Text>{synthesis.content}</Text>
              </Box>
            )}
          </Box>
        )}

        {/* Iteration info */}
        {iterationInfo && (
          <Text color="gray">{iterationInfo}</Text>
        )}

        {/* Final answer */}
        {finalAnswer && (
          <Box flexDirection="column" paddingX={1} marginTop={1}>
            <Text bold>[ANSWER]</Text>
            <Text>{finalAnswer}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Fallback: event list mode (for system messages, errors, etc.)
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {events.map((event, i) => {
        const { label, color } = getEventPrefix(event);
        const isBold = event.type === 'synthesis' || event.type === 'final' || event.type === 'error';
        return (
          <Box key={i} flexDirection="column">
            <Box>
              <Text color={color} bold={isBold}>[{label}]</Text>
              {event.duration != null && <Text color="gray"> {formatDuration(event.duration)}</Text>}
            </Box>
            <Text color={event.type === 'error' ? 'red' : undefined}>{event.content}</Text>
          </Box>
        );
      })}
      {isReasoning && <Text color="gray">|</Text>}
    </Box>
  );
};

function getEventPrefix(event: ReasoningEvent): { label: string; color: string } {
  switch (event.type) {
    case 'scratchpad': return { label: 'SCRATCHPAD', color: 'gray' };
    case 'planner': return { label: 'PLANNER', color: 'cyan' };
    case 'critic': return { label: 'CRITIC', color: 'yellow' };
    case 'adversary': return { label: 'ADVERSARY', color: 'red' };
    case 'view': return { label: `VIEW: ${event.role ?? '?'}`, color: VIEW_COLORS[event.role ?? ''] ?? 'blue' };
    case 'synthesis': return { label: 'SYNTHESIS', color: 'white' };
    case 'system': return { label: '--', color: 'gray' };
    case 'final': return { label: 'ANSWER', color: 'white' };
    case 'error': return { label: 'ERROR', color: 'red' };
  }
}
