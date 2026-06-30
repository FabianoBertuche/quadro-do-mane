export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('pt-BR');
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
