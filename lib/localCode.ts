const KEY = 'boda_codigo';

export function getSavedCode(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(KEY) ?? '';
}

export function saveCode(codigo: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, codigo.toUpperCase());
  window.dispatchEvent(new Event('boda-code-changed'));
}

export function clearCode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('boda-code-changed'));
}
