// Settings > Account privacy: who can see you, who can interact with you, activity status and the people you
// restricted, muted or hid your Moments from. Modelled on Instagram's privacy settings.
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { useSettingUpdate } from '../../lib/useSettingUpdate';
import ActionSheet from '../../components/ActionSheet';
import { MenuRow, Note, Section, Toggle } from '../../components/SettingsUI';
import { ErrorText, s } from '../../components/ui';

const COMMENT = { everyone: 'Everyone', connections: 'Your Connections only', off: 'Off: nobody can comment' };
const CONNECT = { everyone: 'Everyone', matches: 'Strong matches only (Soul Score 70%+)', off: 'Nobody for now' };
const until = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const count = (n, one, many) => (n ? `${n} ${n === 1 ? one : many}` : 'Nobody');

export default function AccountPrivacy() {
  const { user, update, error } = useSettingUpdate();
  const [p, setP] = useState(null);
  const [lists, setLists] = useState({ restricted: [], muted: [], momentsHidden: [] });
  const [err, setErr] = useState(null);
  const [pick, setPick] = useState(null); // 'comment' | 'connect'
  useFocusEffect(useCallback(() => {
    api('/privacy').then((r) => { setP(r.privacy); setLists(r); }).catch((e) => setErr(e.message));
  }, []));
  const save = async (patch) => {
    const prev = p; setP({ ...p, ...patch }); setErr(null);
    try { setP((await api('/privacy', { method: 'PUT', body: patch })).privacy); } catch (e) { setP(prev); setErr(e.message); }
  };
  const go = (path) => () => router.push(path);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <ErrorText>{error || err}</ErrorText>
      <Section>Who can see you</Section>
      <Toggle title="Private account" text="Only people you've accepted (your Connections and Followers) see your posts." value={user.settings.isPrivate} onChange={(v) => update({ isPrivate: v })} />
      <Toggle title="Show me in Discover" text="Let Soulink suggest you to people who match you above 75%." value={user.settings.showInDiscover} onChange={(v) => update({ showInDiscover: v })} />
      <Toggle title="Show my Pulse meter" text={user.settings.showPulse === false ? 'Off: the Pulse meter is hidden on your profile.' : 'Shows how active and loved your profile is, on your profile.'} value={user.settings.showPulse !== false} onChange={(v) => update({ showPulse: v })} />

      {p ? (<>
        <Section>Who can interact with you</Section>
        <MenuRow icon="chatbubble-ellipses" title="Comments" text={COMMENT[p.commentWho]} onPress={() => setPick('comment')} tint={['#7c5cfc', '#ff6b9d']} />
        <MenuRow icon="link" title="Connect requests" text={CONNECT[p.connectWho]} onPress={() => setPick('connect')} tint={['#ff6b9d', '#ff9a5a']} />
        <Toggle title="Replies to my Moments" text="Your Connections can reply to your Moments in chat." value={p.momentReplies} onChange={(v) => save({ momentReplies: v })} />
        <MenuRow icon="eye-off" title="Hidden words" text={p.hideOffensive ? `Offensive words hidden${p.hiddenWords.length ? ` · ${p.hiddenWords.length} of your own` : ''}` : p.hiddenWords.length ? `${p.hiddenWords.length} of your own words` : 'Off'} onPress={go('/settings/hidden-words')} tint={['#5b46d6', '#3fa9f5']} />
        <MenuRow icon="hand-left" title="Limit interactions" text={p.limitUntil ? `On until ${until(p.limitUntil)}` : 'Off'} onPress={go('/settings/limits')} tint={['#f5c842', '#ff9a5a']} />

        <Section>Activity</Section>
        <Toggle title="Show activity status" text="People you chat with see when you were last active. If you turn it off, you won't see theirs either." value={p.showActivity} onChange={(v) => save({ showActivity: v })} />
        <Toggle title="Read receipts" text={'People see "Seen" when you read their messages. If you turn it off, you won\'t see theirs either.'} value={p.readReceipts} onChange={(v) => save({ readReceipts: v })} />

        <Section>People</Section>
        <MenuRow icon="remove-circle" title="Restricted accounts" text={count(lists.restricted.length, 'account', 'accounts')} onPress={go('/settings/people?list=restricted')} tint={['#8b88a0', '#5b46d6']} />
        <MenuRow icon="volume-mute" title="Muted accounts" text={count(lists.muted.length, 'account', 'accounts')} onPress={go('/settings/people?list=muted')} tint={['#8b88a0', '#3fa9f5']} />
        <MenuRow icon="aperture" title="Hide my Moments from" text={count(lists.momentsHidden.length, 'person', 'people')} onPress={go('/settings/people?list=momentsHidden')} tint={['#ff6b9d', '#b08fff']} />
        <Note>To restrict, mute or hide your Moments from someone, open their profile and tap ···. They aren't told.</Note>
      </>) : null}
      <Note>Your Requests count is always visible on your profile, but nobody else can see who sent them.</Note>

      <ActionSheet visible={pick === 'comment'} onClose={() => setPick(null)} title="Who can comment on your posts and Sparks"
        options={Object.entries(COMMENT).map(([k, label]) => ({ label: `${label}${p?.commentWho === k ? '  ✓' : ''}`, onPress: () => save({ commentWho: k }) }))} />
      <ActionSheet visible={pick === 'connect'} onClose={() => setPick(null)} title="Who can send you Connect requests (people who say they know you always can, unless Nobody)"
        options={Object.entries(CONNECT).map(([k, label]) => ({ label: `${label}${p?.connectWho === k ? '  ✓' : ''}`, onPress: () => save({ connectWho: k }) }))} />
    </ScrollView>
  );
}
