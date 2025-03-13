export function escapeMarkdown(text:string) {
    // Escape special characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
    return text.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
  }