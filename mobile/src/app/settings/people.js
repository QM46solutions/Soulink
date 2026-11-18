// Settings > Account privacy > Restricted accounts / Muted accounts / Hide my Moments from.
import { useCallback, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { Note } from '../../components/SettingsUI';
import { Button, Empty, ErrorText, UserRow, s } from '../../components/ui';
import { colors, fonts } from '../../lib/theme';

const LISTS = {
  restricted: { title: 'Restricted accounts', undo: 'Unrestrict', patch: { restricted: false }, empty: 'Nobody restricted',
    note: "Restricted people can still see your posts. Their new comments on your posts are seen only by them, and they aren't told." },
  muted: { title: 'Muted accounts', undo: 'Unmute', patch: { mutePosts: false, muteMoments: false }, empty: 'Nobody muted',
    note: "You don't see muted people's posts or Moments in your feed. They aren't told, and you're still connected." },
  momentsHidden: { title: 'Hide my Moments from', undo: 'Show', patch: { momentsHidden: false }, empty: 'Your Moments are shown to all your Connections',
    note: "These people don't see your Moments, even though you're connected. They aren't told." },
};
const mutedText = (u) => (u.mutePosts && u.muteMoments ? 'Posts and Moments muted' : u.mutePosts ? 'Posts muted' : 'Moments muted');

export default function PrivacyPeople() {
  const { list } = useLocalSearchParams();
  const L = LISTS[list] || LISTS.restricted;
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);
  useFocusEffect(useCallback(() => { api('/privacy').then((r) => setPeople(r[list] || [])).catch((e) => setError(e.message)); }, [list]));
  const undo = async (u) => {
    try { await api(`/privacy/people/${u.id}`, { method: 'PUT', body: L.patch }); setPeople((x) => x.filter((p) => p.id !== u.id)); }
    catch (e) { setError(e.message); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: L.title }} />
      <ErrorText>{error}</ErrorText>
      {people && !people.length ? <Empty icon="people-outline" title={L.empty} /> : null}
      {(people || []).map((u) => (
        <UserRow key={u.id} user={u} onPress={() => router.push(`/user/${u.username}`)}
          subtitle={list === 'muted' ? mutedText(u) : undefined}
          right={<Button title={L.undo} small variant="ghost" onPress={() => undo(u)} />} />
      ))}
      <Note>{L.note}</Note>
      <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Add someone from their profile: tap ··· on it.</Text>
    </ScrollView>
  );
}
