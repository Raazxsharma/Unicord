/**
 * Discord Clone Markdown & Text Formatting Parser
 * Safely parses Discord-flavored markdown, emojis, mentions, blockquotes, spoilers, and links.
 */

var MarkdownParser = {
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  parse(text) {
    if (!text) return '';

    // If it's already an HTML embed or structured block, pass through safely
    if (text.startsWith('<div class="discord-embed"')) {
      return text;
    }

    // First escape raw HTML
    let output = this.escapeHtml(text);

    // 1. Code blocks (```language ... ```)
    output = output.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // 2. Inline code (`code`)
    output = output.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 3. Spoilers (||spoiler||)
    output = output.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');

    // 4. Bold + Italic (***text***)
    output = output.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');

    // 5. Bold (**text**)
    output = output.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 6. Underline (__text__)
    output = output.replace(/__(.*?)__/g, '<u>$1</u>');

    // 7. Strikethrough (~~text~~)
    output = output.replace(/~~(.*?)~~/g, '<s>$1</s>');

    // 8. Italic (*text* or _text_)
    output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    output = output.replace(/_([^_]+)_/g, '<em>$1</em>');

    // 9. Blockquotes (> quote)
    output = output.replace(/^>(?:>| )?(.*)$/gm, '<blockquote>$1</blockquote>');

    // 10. Markdown links [Text](URL)
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>');

    // 11. User Mentions (@username or @everyone or @here)
    output = output.replace(/(@[a-zA-Z0-9_\-]+)/g, '<span class="mention">$1</span>');

    // 12. Raw URLs
    output = output.replace(
      /(?<!href=")(?<!">)(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
    );

    // 13. Newlines to <br> (except inside pre blocks)
    output = output.replace(/\n/g, '<br>');

    return output;
  }
};

window.MarkdownParser = MarkdownParser;
