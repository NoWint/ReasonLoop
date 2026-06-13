import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  provider: string;
  model: string;
  multiView: boolean;
  debateMode: boolean;
  iteration: number;
  maxIterations: number;
  stability: number;
  budget: number;
  budgetLimit: number;
  serveMode: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  provider,
  model,
  multiView,
  debateMode,
  iteration,
  maxIterations,
  stability,
  budget,
  budgetLimit,
  serveMode,
}) => {
  const budgetPercent = budgetLimit > 0 ? budget / budgetLimit : 0;
  const budgetColor = budgetPercent > 0.8 ? 'yellow' : 'green';
  const stabilityColor = stability >= 0.5 ? 'green' : 'yellow';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>ReasonLoop v0.1.0</Text>
      <Text> | </Text>
      <Text color="cyan">{model}</Text>
      <Text> | </Text>
      {debateMode ? (
        <Text color="magenta">DEBATE</Text>
      ) : multiView ? (
        <Text color="green">multi-view: ON</Text>
      ) : (
        <Text color="gray">standard</Text>
      )}
      <Text> | </Text>
      <Text>iter: {iteration}/{maxIterations}</Text>
      <Text> | </Text>
      <Text color={stabilityColor}>stability: {stability.toFixed(2)}</Text>
      <Text> | </Text>
      <Text color={budgetColor}>budget: {budget}/{budgetLimit}</Text>
      <Text> | </Text>
      {serveMode ? (
        <Text color="green">serve: ON</Text>
      ) : (
        <Text color="gray">serve: OFF</Text>
      )}
    </Box>
  );
};
