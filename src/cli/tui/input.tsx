import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ value, onChange, onSubmit, disabled }) => {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box>
        {disabled ? (
          <>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text color="gray"> reasoning...</Text>
          </>
        ) : (
          <>
            <Text color="cyan">&gt; </Text>
            <TextInput
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              placeholder="type your question here..."
              showCursor={true}
            />
          </>
        )}
      </Box>
      <Box>
        <Text color="gray">  /help /config /multi-view /serve /clear  Ctrl+C</Text>
      </Box>
    </Box>
  );
};
