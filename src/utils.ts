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

/** Quantos marcadores [--] o comando tem. */
export function countCommandPlaceholders(command: string): number {
  return command.split(ROUTINE_PLACEHOLDER).length - 1;
}

/**
 * Valores escritos entre `[-` e `-]` no complemento, na ordem em que aparecem:
 * `cd [-/home-] && ls [-/root-]` rende `['/home', '/root']`.
 *
 * `[\s\S]*?` é preguiçoso e aceita QUALQUER caractere dentro do valor —
 * espaço, vírgula, ponto, barra, barra invertida, quebra de linha e o próprio
 * `-`. Preguiçoso é o que faz `[-a-b-]` render `a-b` e `[-foo--]` render `foo-`:
 * o fechamento é o primeiro `-]` que aparecer daí em diante.
 *
 * Retorna null quando não há nenhum `[-…-]`, e aí o complemento é um valor
 * solto só — o jeito antigo, que preenche todos os marcadores igual.
 */
export function extractComplementValues(complement: string): string[] | null {
  const values = [...complement.matchAll(/\[-([\s\S]*?)-\]/g)].map((m) => m[1]);
  return values.length ? values : null;
}

/**
 * Monta o comando final de uma rotina parcial preservando as quebras de linha.
 *
 * Com [--] no comando, o complemento preenche os marcadores na ordem:
 *   - um valor só (`[-teste-]` ou texto solto) vai para TODOS os marcadores;
 *   - um `[-valor-]` por marcador dá um texto diferente a cada um;
 *   - faltando valor, o último se repete nos marcadores restantes.
 * Só os valores são aproveitados: o texto ao redor deles é ignorado, então o
 * comando salvo na rotina continua sendo o que manda no que vai rodar.
 *
 * Sem marcador, o complemento é anexado ao fim, como sempre foi.
 */
export function buildRoutineCommand(command: string, complement: string): string {
  const base = normalizeCommand(command);
  if (!hasCommandPlaceholder(base)) {
    const extra = normalizeCommand(complement);
    return extra ? `${base} ${extra}` : base;
  }

  // extrai do texto cru (só CRLF virando LF): espaço e afins dentro do valor
  // são conteúdo e não podem ser aparados
  const raw = complement.replace(/\r\n?/g, '\n');
  const values = extractComplementValues(raw) ?? [normalizeCommand(complement)];

  // split/join manual em vez de replaceAll: replaceAll interpreta `$&`, `$'` e
  // afins no texto de substituição, e complemento de shell usa `$` à vontade
  const parts = base.split(ROUTINE_PLACEHOLDER);
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    out += values[Math.min(i - 1, values.length - 1)] + parts[i];
  }
  return out;
}
