/** Rotula um lembrete de calendário a partir dos dias restantes até o evento. */
export function reminderWhenLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Hoje';
  if (daysLeft === 1) return 'Amanhã';
  return `Em ${daysLeft} dias`;
}