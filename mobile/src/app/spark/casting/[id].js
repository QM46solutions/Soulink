// One casting call: the role and lines, everyone's auditions, "Audition" for you, "Pick" for the caster.
import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { confirm, notice } from '../../../lib/confirm';
import SparkCard from '../../../components/SparkCard';
import { Empty, Loading } from '../../../components/ui';
import { GradBadge, GradButton, H, RequirementChips, left } from '../../../components/SparkHub';
import { colors, fonts, space } from '../../../lib/theme';

export default function CastingCall() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const load = useCallback(async () => { try { setData(await api(`/sparks/casting/${id}`)); } catch (e) { notice('Casting', e.message); } }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Casting call',
      headerRight: () => (data?.call?.mine ? (
        <Pressable onPress={async () => { if (await confirm('Delete this casting call?', undefined, { confirmText: 'Delete', destructive: true })) { await api(`/sparks/casting/${id}`, { method: 'DELETE' }).catch(() => {}); router.back(); } }} hitSlop={10} style={{ marginRight: 16 }}>
          <Ionicons name="trash-outline" size={20} color={colors.muted} />
        </Pressable>
      ) : null),
    });
  }, [navigation, data?.call?.mine, id]);
  if (!data) return <Loading />;
  const c = data.call;
  const pick = async (sparkId) => {
    if (!(await confirm('Pick this audition?', 'The role closes and they get a notification.', { confirmText: 'Pick' }))) return;
    try { await api(`/sparks/casting/${id}/pick`, { method: 'POST', body: { sparkId } }); load(); } catch (e) { notice('Oops', e.message); }
  };
  return (
    <FlatList
      data={data.auditions}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <View>
          {c.pickedSparkId === item.id ? <Text style={{ fontFamily: fonts.bold, color: colors.gold, fontSize: 14, marginLeft: space.lg, marginBottom: 6 }}>🌟 Picked for the role</Text> : null}
          <SparkCard spark={item} onDeleted={load} />
          {c.mine && c.open ? <GradButton title="Pick this audition" icon="star" onPress={() => pick(item.id)} style={{ marginHorizontal: space.lg, marginTop: -space.md, marginBottom: space.xl, height: 44 }} /> : null}
        </View>
      )}
      ListHeaderComponent={
        <View style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <GradBadge icon="drama-masks" size={52} colors={['#7c5cfc', '#ff6b9d']} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>{c.title}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.open ? colors.mint : colors.muted }}>{c.pickedSparkId ? '🌟 Role filled' : left(c.endsAt)} · cast by {c.author?.displayName || c.author?.username}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text, marginTop: space.md }}>{c.role}</Text>
          <RequirementChips r={c.requirements} style={{ marginTop: space.md }} />
          {c.script ? (
            <View style={{ marginTop: space.md, padding: space.lg, borderRadius: 16, backgroundColor: 'rgba(26,24,40,0.85)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.25)' }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.aura, letterSpacing: 1 }}>THE LINES</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.text, marginTop: 6 }}>“{c.script}”</Text>
            </View>
          ) : null}
          {c.open && !c.mine ? <GradButton title="Audition for this role" icon="video" onPress={() => router.push({ pathname: '/spark/new', params: { casting: c.id } })} style={{ marginTop: space.lg }} /> : null}
          <H>{`Auditions · ${data.auditions.length}`}</H>
        </View>
      }
      ListEmptyComponent={<Empty icon="videocam-outline" title="No auditions yet" text={c.mine ? 'Share the role with your friends.' : 'Be the first to audition.'} />}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  );
}
