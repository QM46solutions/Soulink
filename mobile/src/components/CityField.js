// City: asks to use your location first (fills in e.g. "Kondapur, Hyderabad"), and suggests places as you type.
// Works on phones and in the browser. Place search runs on our own server (no paid map service).
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { colors, fonts, space } from '../lib/theme';
import { Input, s } from './ui';

export default function CityField({ value, onChange, autoLocate = true }) {
  const [suggestions, setSuggestions] = useState([]);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState(null);
  const [focused, setFocused] = useState(false);
  const timer = useRef(null);
  const asked = useRef(false);

  const locate = async () => {
    setLocating(true); setNote(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setNote('Location is off. Type your city instead.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const r = await api(`/places/near?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      if (r.place) { onChange(r.place.label); setSuggestions([]); setNote(`Found you: ${r.place.label}. Tap to change.`); }
      else setNote("Couldn't match your location to a city. Type it instead.");
    } catch {
      setNote("Couldn't get your location. Type your city instead.");
    } finally { setLocating(false); }
  };

  // Ask for location as soon as this step opens (only once, and only if the city is empty)
  useEffect(() => {
    if (autoLocate && !asked.current && !value) { asked.current = true; locate(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const type = (t) => {
    onChange(t); setNote(null);
    clearTimeout(timer.current);
    if (t.trim().length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      try { setSuggestions((await api(`/places/search?q=${encodeURIComponent(t)}`)).places); } catch { setSuggestions([]); }
    }, 200);
  };

  return (
    <View style={{ marginBottom: space.lg }}>
      <Input
        label="City"
        value={value}
        onChangeText={type}
        placeholder="Start typing, e.g. Gachibowli"
        maxLength={60}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        style={{ marginBottom: 0 }}
        left={<Ionicons name="location-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />}
        right={locating ? <ActivityIndicator color={colors.aura} /> : (
          <Pressable onPress={locate} hitSlop={10} accessibilityLabel="Use my current location">
            <Ionicons name="locate" size={20} color={colors.aura} />
          </Pressable>
        )}
      />
      {focused && suggestions.length ? (
        <View style={{ marginTop: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' }}>
          {suggestions.map((p, i) => (
            <Pressable key={p.label} onPress={() => { onChange(p.label); setSuggestions([]); setNote(null); }}
              style={({ hovered, pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: hovered || pressed ? 'rgba(124,92,252,0.15)' : 'transparent' })}>
              <Ionicons name="location" size={14} color={colors.aura} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 15 }}>{p.label}</Text>
                {p.sub ? <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>{p.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {locating ? <Text style={s.hint}>Finding your city…</Text>
        : note ? <Text style={s.hint}>{note}</Text>
        : <Text onPress={locate} style={[s.hint, { color: colors.aura, fontFamily: fonts.semibold }]}>Use my current location</Text>}
    </View>
  );
}
