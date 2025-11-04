import type { Message } from './chat';

interface GroupedToolMessage extends Message {
  groupCount?: number;
  groupedTools?: Array<{
    label: string;
    details: string;
  }>;
}

export function groupToolMessages(messages: Message[]): GroupedToolMessage[] {
  const grouped: GroupedToolMessage[] = [];
  let currentGroup: Message[] = [];
  let currentToolName: string | null = null;

  for (const message of messages) {
    // Only group tool messages
    if (message.variant === 'tool' && message.toolDetails) {
      const toolLabel = message.toolDetails.label;

      // If same tool type, add to current group
      if (toolLabel === currentToolName) {
        currentGroup.push(message);
      } else {
        // Different tool or first tool - flush current group
        if (currentGroup.length > 0) {
          grouped.push(createGroupedMessage(currentGroup));
        }
        currentGroup = [message];
        currentToolName = toolLabel;
      }
    } else {
      // Not a tool message - flush current group and add this message
      if (currentGroup.length > 0) {
        grouped.push(createGroupedMessage(currentGroup));
        currentGroup = [];
        currentToolName = null;
      }
      grouped.push(message);
    }
  }

  // Flush any remaining group
  if (currentGroup.length > 0) {
    grouped.push(createGroupedMessage(currentGroup));
  }

  return grouped;
}

function createGroupedMessage(messages: Message[]): GroupedToolMessage {
  if (messages.length === 1) {
    return messages[0];
  }

  // Multiple messages of same type - create grouped message
  const first = messages[0];
  return {
    ...first,
    groupCount: messages.length,
    groupedTools: messages.map(m => ({
      label: m.toolDetails?.label || '',
      details: m.toolDetails?.details || '',
    })),
  };
}
