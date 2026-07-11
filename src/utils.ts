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

export const STATE_LABELS: Record<string, string> = {
  running: 'Rodando',
  exited: 'Parado',
  paused: 'Pausado',
  created: 'Criado',
  restarting: 'Reiniciando',
  dead: 'Morto',
};

export function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}
