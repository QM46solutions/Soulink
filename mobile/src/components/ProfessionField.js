// Profession: free text (type anything). The keywords below only fill the box to save typing; nobody has to pick one.
// "I'm a content creator" is separate, so a software engineer can be a creator too.
import { Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input, s } from './ui';
import { colors, fonts, space } from '../lib/theme';

const KEYWORDS = ['Software engineer', 'Business owner', 'Student', 'Doctor', 'Designer', 'Teacher', 'Entrepreneur', 'Freelancer',
  'Marketing', 'Finance', 'Engineer', 'Artist', 'Actor', 'Photographer', 'Lawyer', 'Government job'];

export default function ProfessionField({ value, onChange, creator, onCreator, required }) {
  const v = value.trim().toLowerCase();
  return (
    <View>
      <Input label={required ? 'Your profession' : 'Profession'} value={value} onChangeText={onChange} maxLength={80}
        placeholder="e.g. Software engineer at Infosys, Biryani shop owner" hint="Type it in your own words. Shown under your profile photo." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -space.sm, marginBottom: space.md }}>
        {KEYWORDS.map((k) => {
          const on = v === k.toLowerCase();
          return (
            <Pressable key={k} onPress={() => onChange(on ? '' : k)} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, margin: 3,
              borderColor: on ? colors.soul : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.2)' : 'transparent' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: on ? colors.text : colors.muted }}>{k}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[s.row, { justifyContent: 'space-between', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, padding: space.md, borderRadius: 16, marginBottom: space.lg }]}>
        <Ionicons name="videocam" size={18} color={colors.aura} style={{ marginRight: space.sm }} />
        <View style={{ flex: 1, marginRight: space.md }}>
          <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>I'm a content creator</Text>
          <Text style={[s.hint, { marginLeft: 0 }]}>Shows a "Content creator" badge on your profile.</Text>
        </View>
        <Switch value={!!creator} onValueChange={onCreator} trackColor={{ true: colors.soul, false: colors.border }} thumbColor="#fff" />
      </View>
    </View>
  );
}
