// Settings > App permissions: what Soulink itself may do with your data.
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { api } from '../../lib/api';
import { CHAT_LANGS } from '../../lib/languages';
import ActionSheet from '../../components/ActionSheet';
import { MenuRow, Note, Section, Toggle } from '../../components/SettingsUI';
import { ErrorText, s } from '../../components/ui';
import { useSettingUpdate } from '../../lib/useSettingUpdate';

export default function AppPermissions() {
  const { user, setUser, update, error, setError } = useSettingUpdate();
  const [langOpen, setLangOpen] = useState(false);
  const setChatLanguage = async (chatLanguage) => {
    try { setUser((await api('/users/me', { method: 'PATCH', body: { chatLanguage } })).user); } catch (e) { setError(e.message); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <ErrorText>{error}</ErrorText>
      <Section>Soulink may</Section>
      <Toggle title="Use my activity for Soul DNA" text="Searches, likes and time spent on profiles help improve your matches. Never shared with anyone." value={user.settings.consentTracking} onChange={(v) => update({ consentTracking: v })} />
      <MenuRow icon="language" title="Translate my chats" text={user.chatLanguage ? `Into ${CHAT_LANGS.find((l) => l.key === user.chatLanguage)?.native}` : 'Off'} onPress={() => setLangOpen(true)} tint={['#58a0e6', '#7c5cfc']} />
      <ActionSheet visible={langOpen} onClose={() => setLangOpen(false)} title="Translate chat messages into"
        options={CHAT_LANGS.map((l) => ({ label: `${l.native}${l.native !== l.label ? `  ·  ${l.label}` : ''}${user.chatLanguage === l.key ? '  ✓' : ''}`, onPress: () => setChatLanguage(l.key) }))} />
      <Note>Camera, microphone, photos and location are allowed by your phone: see Device permissions.</Note>
    </ScrollView>
  );
}
