// src/telegram/helpers/escape-markdown.ts
export function escapeMarkdown(text: string) {
  if (!text) return '';
  
  // For Telegram's Markdown, we only need to escape: _ * [ ]
  // We don't need to escape parentheses for regular Markdown mode
  return text.replace(/([_*\[\]])/g, '\\$1');
}

// If you want to use MarkdownV2 instead (which requires more escaping):
export function escapeMarkdownV2(text: string) {
  if (!text) return '';
  
  // For MarkdownV2, escape these special characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*\[\]()~`>#+=|{}.!\-])/g, '\\$1');
}