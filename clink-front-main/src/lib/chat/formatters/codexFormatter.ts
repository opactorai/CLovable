/**
 * Codex/OpenAI-specific message formatting
 * Handles the common patterns in Codex responses
 */

/**
 * Pre-process Codex markdown to add visual improvements
 * - Add spacing between bullet sections
 * - Differentiate file paths from CSS classes
 * - Enhance bold section headers
 */
export const preprocessCodexMarkdown = (content: string): string => {
  if (!content) return '';

  let processed = content;

  // Don't modify bold headers - keep them inline with content for proper list item formatting
  // The CSS mb-4 on <li> elements will handle spacing between items

  return processed;
};

/**
 * Extract text content from Codex response
 */
export const extractCodexText = (raw: any): string => {
  if (!raw) return '';
  
  // Handle streaming format
  if (raw.choices?.[0]?.delta?.content) {
    return raw.choices[0].delta.content;
  }
  
  // Handle complete message format
  if (raw.choices?.[0]?.message?.content) {
    return raw.choices[0].message.content;
  }
  
  // Handle direct content
  if (typeof raw.content === 'string') {
    return raw.content;
  }
  
  if (typeof raw === 'string') {
    return raw;
  }
  
  return '';
};
