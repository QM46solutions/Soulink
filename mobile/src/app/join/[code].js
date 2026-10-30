// Joining a group from its invite link (logged in only): the group's name, photo and member count, and Join.
// No messages are ever shown before joining.
import { useEffect, useLayoutEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { api } from '../../lib/api';
import { ConversationAvatar } from '../../components/chat';
import { Button, ErrorText, Loading } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

export default function JoinGroup() {
  const { code } = useLocalSearchParams();
  const navigation = useNavigation();
  useLayoutEffect(() => { navigation.setOptions({ title: 'Group invite' }); }, [navigation]);
  const [g, setG] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/conversations/invite/${code}`).then((r) => setG(r.group)).catch((e) => setError(e.message)); }, [code]);
  const join = async () => {
    setBusy(true); setError(null);
    try { const r = await api(`/conversations/invite/${code}/join`, { method: 'POST' }); router.replace(`/chat/${r.conversation.id}`); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  if (!g && !error) return <Loading />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
      {g ? (
        <>
          <ConversationAvatar conversation={{ isGroup: true, title: g.title, avatarUrl: g.avatarUrl, members: [] }} size={88} />
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: space.lg, textAlign: 'center' }}>{g.title}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 4 }}>Group · {g.members} {g.members === 1 ? 'member' : 'members'}</Text>
          <Button title={g.joined ? 'Open the chat' : 'Join group'} loading={busy} style={{ marginTop: space.xl, alignSelf: 'stretch' }}
            onPress={g.joined ? () => router.replace(`/chat/${g.id}`) : join} />
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
