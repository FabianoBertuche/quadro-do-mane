import { View } from 'react-native';
import { colors } from '@/theme/colors';

/**
 * Rota inicial — a guarda no _layout raiz redireciona
 * para /login ou /dashboard conforme a sessão.
 */
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
