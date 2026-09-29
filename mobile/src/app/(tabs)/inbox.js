// The Messages tab button opens /messages (the inbox keeps its own stack for chats). If this tab is ever
// opened directly, go there too.
import { Redirect } from 'expo-router';

export default function InboxTab() {
  return <Redirect href="/messages" />;
}
