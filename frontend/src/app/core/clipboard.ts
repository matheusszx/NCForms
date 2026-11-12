/**
 * Copies text to the clipboard. The Clipboard API only exists in a secure context
 * (HTTPS/localhost); on plain HTTP servers it falls back to execCommand.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // try the fallback
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function publicFormUrl(slug: string): string {
  // Resolve against <base href> so the link also works when the app is served from a subpath (GitHub Pages).
  return new URL(`f/${encodeURIComponent(slug)}`, document.baseURI).href;
}
