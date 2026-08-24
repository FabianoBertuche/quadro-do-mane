import { AuditFeedScreen } from '@/screens/audit-feed';

export default function AuditScreen() {
  return (
    <AuditFeedScreen
      endpoint="/audit-log"
      title="Auditoria"
      subtitle="Todos os eventos de segurança e alterações"
    />
  );
}
