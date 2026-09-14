export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ---------- Rotinas ---------- */

/** Marcador que indica ONDE o complemento entra no comando de uma rotina. */
export const ROUTINE_PLACEHOLDER = '[--]';

/**
 * Limpa o texto de um comando sem achatá-lo: CRLF vira LF, espaço sobrando no
 * fim de cada linha some e as pontas ficam aparadas. As quebras de linha que a
 * pessoa digitou são preservadas — elas chegam ao `sh -c` exatamente como
 * foram escritas. A quebra automática da interface é só visual e nunca injeta
 * caractere nenhum aqui.
 */
export function normalizeCommand(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/** O nome do atalho é uma linha só: ele quebra na tela, não no dado. */
export function normalizeLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Rotina com [--] pede complemento e o insere em cada marcador. */
export function hasCommandPlaceholder(command: string): boolean {
  return command.includes(ROUTINE_PLACEHOLDER);
}

/** Pede complemento quando está marcada como parcial OU usa [--]. */
export function isPartialRoutine(routine: { command: string; partial: boolean }): boolean {
  return routine.partial || hasCommandPlaceholder(routine.command);
}

/**
 * Monta o comando final de uma rotina parcial preservando as quebras de linha.
 * Com [--] o complemento entra em CADA marcador; sem marcador ele é anexado ao
 * fim do comando, como sempre foi.
 *
 * Usa split/join em vez de replaceAll porque replaceAll interpreta `$&`, `$'`
 * e afins no texto de substituição — complementos de shell usam `$` à vontade.
 */
export function buildRoutineCommand(command: string, complement: string): string {
  const base = normalizeCommand(command);
  const extra = normalizeCommand(complement);
  if (hasCommandPlaceholder(base)) return base.split(ROUTINE_PLACEHOLDER).join(extra);
  if (!extra) return base;
  return `${base} ${extra}`;
}
