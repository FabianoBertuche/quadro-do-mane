import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ProjectChatRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/ai-chat', params: { contextProjectId: id } }} />;
}
