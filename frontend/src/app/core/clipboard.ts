/**
 * Copia texto para a área de transferência. A Clipboard API só existe em contexto
 * seguro (HTTPS/localhost); em servidores HTTP usa o fallback com execCommand.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // tenta o fallback
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
  return `${window.location.origin}/f/${slug}`;
}
