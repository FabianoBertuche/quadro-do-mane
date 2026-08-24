import { AuditFeedScreen } from '@/screens/audit-feed';

export default function OperationalScreen() {
  return (
    <AuditFeedScreen
      endpoint="/audit-log/activity"
      title="Atividades"
      subtitle="Mudanças operacionais recentes"
    />
  );
}
