import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { confirm, notice } from '../../../lib/confirm';
import { ConversationAvatar } from '../../../components/chat';
import ReportModal from '../../../components/ReportModal';
import ActionSheet from '../../../components/ActionSheet';
import { Button, ErrorText, Input, Loading, UserRow } from '../../../components/ui';
import { colors, fonts, space } from '../../../lib/theme';

function Row({ icon, label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 14, backgroundColor: pressed ? 'rgba(124,92,252,0.08)' : 'transparent' })}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.muted} style={{ marginRight: space.md }} />
      <Text style={{ color: danger ? colors.danger : colors.text, fontFamily: fonts.body, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

// Chat details: members, rename, add people, leave (groups) · profile, report, block (1:1)
export default function ChatInfo() {
  const { id } = useLocalSearchParams();
  const { user: me } = useAuth();
  const [conv, setConv] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [memberMenu, setMemberMenu] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { const r = await api(`/conversations/${id}`); setConv(r.conversation); setTitle(r.conversation.title); } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!adding || !q.trim()) { setResults([]); return undefined; }
    const t = setTimeout(async () => {
      try { setResults((await api(`/search/users?q=${encodeURIComponent(q.trim())}`)).users); } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q, adding]);

  if (!conv) return error ? <ErrorText>{error}</ErrorText> : <Loading />;
  const isAdmin = conv.myRole === 'admin';

  const rename = async () => {
    try { const r = await api(`/conversations/${id}`, { method: 'PATCH', body: { title } }); setConv(r.conversation); setRenaming(false); } catch (e) { notice('Could not rename', e.message); }
  };
  const addMember = async (u) => {
    try { const r = await api(`/conversations/${id}/members`, { method: 'POST', body: { userIds: [u.id] } }); setConv(r.conversation); setAdding(false); setQ(''); } catch (e) { notice('Could not add', e.message); }
  };
  const removeMember = async (m) => {
    if (!(await confirm(`Remove ${m.username} from the group?`, undefined, { confirmText: 'Remove', destructive: true }))) return;
    await api(`/conversations/${id}/members/${m.id}`, { method: 'DELETE' });
    load();
  };
  const leave = async () => {
    if (!(await confirm('Leave this group?', "You won't get new messages from it.", { confirmText: 'Leave', destructive: true }))) return;
    await api(`/conversations/${id}/members/me`, { method: 'DELETE' });
    router.dismissTo('/messages');
  };
  const block = async () => {
    if (!(await confirm(`Block ${conv.other.username}?`, "They won't be able to message you or find your profile.", { confirmText: 'Block', destructive: true }))) return;
    await api(`/blocks/${conv.other.id}`, { method: 'POST' });
    router.dismissTo('/messages');
  };

  const header = (
    <View>
      <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
        <ConversationAvatar conversation={{ ...conv, meId: me.id }} size={84} />
        <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 20, marginTop: space.md }}>{conv.title}</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 }}>
          {conv.isGroup ? `Group · ${conv.members.length} members` : `@${conv.other?.username}`}
        </Text>
      </View>
      {conv.isGroup ? (
        <>
          {isAdmin ? <Row icon="create-outline" label="Change group name" onPress={() => setRenaming(true)} /> : null}
          {isAdmin ? <Row icon="person-add-outline" label="Add people" onPress={() => setAdding(true)} /> : null}
          <Text style={{ color: colors.dim, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>Members</Text>
        </>
      ) : (
        <>
          <Row icon="person-circle-outline" label="View profile" onPress={() => router.push(`/user/${conv.other.username}`)} />
          <Row icon="flag-outline" label="Report" danger onPress={() => setReporting(true)} />
          <Row icon="ban-outline" label="Block" danger onPress={block} />
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={conv.isGroup ? conv.members : []}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            subtitle={item.id === me.id ? 'You' : item.role === 'admin' ? 'Admin' : item.displayName}
            onPress={() => (item.id === me.id ? null : isAdmin ? setMemberMenu(item) : router.push(`/user/${item.username}`))}
          />
        )}
        ListFooterComponent={conv.isGroup ? <View style={{ marginTop: space.lg }}><Row icon="exit-outline" label="Leave group" danger onPress={leave} /></View> : null}
      />

      <ActionSheet
        visible={!!memberMenu}
        onClose={() => setMemberMenu(null)}
        title={memberMenu?.username}
        options={[
          { label: 'View profile', onPress: () => router.push(`/user/${memberMenu.username}`) },
          { label: 'Remove from group', destructive: true, onPress: () => removeMember(memberMenu) },
        ]}
      />
      {!conv.isGroup ? <ReportModal visible={reporting} onClose={() => setReporting(false)} targetType="user" targetId={conv.other?.id} /> : null}

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <Pressable onPress={() => setRenaming(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.xl }}>
          <Pressable style={{ backgroundColor: colors.deep, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: space.xl }}>
            <Input label="Group name" value={title} onChangeText={setTitle} maxLength={100} autoFocus />
            <Button title="Save" onPress={rename} disabled={!title.trim()} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, backgroundColor: colors.void, paddingTop: 50 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.md }}>
            <Pressable onPress={() => setAdding(false)} hitSlop={10}><Ionicons name="close" size={26} color={colors.text} /></Pressable>
            <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 18, marginLeft: space.md }}>Add people</Text>
          </View>
          <View style={{ paddingHorizontal: space.lg }}>
            <Input placeholder="Search people" value={q} onChangeText={setQ} autoCapitalize="none" autoFocus />
          </View>
          <FlatList
            data={results.filter((u) => !conv.members.some((m) => m.id === u.id))}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <UserRow user={item} onPress={() => addMember(item)} right={<Ionicons name="add-circle-outline" size={24} color={colors.aura} />} />}
          />
        </View>
      </Modal>
    </View>
  );
}
