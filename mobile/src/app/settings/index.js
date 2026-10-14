// Settings: one clean menu. Every item opens its own page (nothing expands here).
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { confirm } from '../../lib/confirm';
import { retakeSoulDna } from '../../lib/retake';
import { MenuRow, Note, Section } from '../../components/SettingsUI';
import { s } from '../../components/ui';
import { downloadMyData } from '../../lib/export-data';

const go = (p) => () => router.push(p);

// Floating Soul Shop button (bottom-right): a gradient bubble with a bag that gently bobs
function ShopButton() {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const nd = Platform.OS !== 'web';
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: nd }),
      Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: nd }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const y = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: space.lg, bottom: 16, alignItems: 'center' }}>
      <Pressable onPress={() => router.push('/shop')} accessibilityRole="button" accessibilityLabel="Soul Shop"
        style={({ hovered, pressed }) => ({ width: 66, height: 66, borderRadius: 33, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.45)', transform: [{ scale: pressed ? 0.92 : hovered ? 1.06 : 1 }],
          ...(Platform.OS === 'web' ? { cursor: 'pointer', outlineStyle: 'none', boxShadow: '0 10px 28px rgba(255,107,157,0.38), 0 0 0 4px rgba(124,92,252,0.14)' } : { shadowColor: '#ff6b9d', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 }) })}>
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={{ transform: [{ translateY: y }] }}>
          <MaterialCommunityIcons name="shopping" size={32} color="#fff" />
        </Animated.View>
      </Pressable>
      <Text style={{ marginTop: 4, fontFamily: fonts.semibold, fontSize: 11, color: colors.muted }}>Shop</Text>
    </View>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 110 }}>
      <Section>You</Section>
      <MenuRow icon="pulse" title="Your activity" text="Likes, comments and requests you sent" onPress={go('/settings/activity')} tint={['#7c5cfc', '#b08fff']} />
      <MenuRow icon="hourglass-outline" title="Time management" text="Daily time on Soulink, limits and breaks" onPress={go('/settings/time')} tint={['#42e8c0', '#3fa9f5']} />
      <MenuRow icon="notifications" title="Notifications" text="Phone alerts and what you hear about" onPress={go('/settings/notifications')} tint={['#ff6b9d', '#ff9a5a']} />
      <MenuRow icon="git-network" title="Retake Soul DNA" text={user.isPremium ? 'Premium 💎 · answer everything again' : 'Premium 💎 · start your Soul DNA again'} onPress={() => retakeSoulDna(user)} tint={['#f5c842', '#ff6b9d']} />
      <MenuRow icon="eye" title="Who viewed my profile" text="Top 3 free · everyone with Premium 💎" onPress={go('/settings/viewers')} tint={['#b08fff', '#ff6b9d']} />

      <Section>Privacy & safety</Section>
      <MenuRow icon="lock-closed" title="Account privacy" text="Private account, Discover, Pulse meter" onPress={go('/settings/privacy')} tint={['#5b46d6', '#7c5cfc']} />
      <MenuRow icon="ban" title="Blocked contacts" text="People you've blocked" onPress={go('/blocked')} tint={['#8b88a0', '#4a4760']} />
      <MenuRow icon="shield-checkmark" title="Account status" text="Verification, warnings and reports" onPress={go('/settings/status')} tint={['#42e8c0', '#2bb673']} />

      <Section>Permissions</Section>
      <MenuRow icon="apps" title="App permissions" text="What Soulink may use: activity, translation" onPress={go('/settings/app-permissions')} tint={['#f5c842', '#ff9a5a']} />
      <MenuRow icon="location" title="Location" text={user.hasLocation ? 'On: used for distance in Discover' : 'Off'} onPress={go('/settings/location')} tint={['#3fa9f5', '#5b46d6']} />
      <MenuRow icon="phone-portrait-outline" title="Device permissions" text="Camera, microphone, photos, location, notifications" onPress={go('/settings/device-permissions')} tint={['#58a0e6', '#42e8c0']} />

      <Section>Legal & your data</Section>
      <MenuRow icon="document-text" title="Terms & policies" text="Terms, Privacy, Guidelines, Refunds" onPress={go('/legal/terms')} tint={['#7c5cfc', '#3fa9f5']} />
      <MenuRow icon="help-buoy" title="Grievance Officer" text="Complaints about content, your account or data" onPress={go('/legal/grievance')} tint={['#ff9a5a', '#ff6b9d']} />
      <MenuRow icon="download" title="Download my data" text="A copy of your profile, posts, chats and more" onPress={downloadMyData} tint={['#42e8c0', '#3fa9f5']} />
      <MenuRow icon="cloud-upload" title="Restore my data" text="Coming back? Bring back your profile and Soul DNA" onPress={go('/settings/restore-data')} tint={['#7c5cfc', '#42e8c0']} />
      <MenuRow icon="pause-circle" title="Pause my account" text="Hide everything for a while; nothing is deleted" onPress={go('/settings/pause-account')} tint={['#f5c842', '#8b88a0']} />
      <MenuRow icon="trash" title="Delete my account" text="Deleted after 30 days; log in before then to cancel" onPress={go('/settings/delete-account')} tint={['#ff5c7a', '#8b2a3c']} />

      <Section>More</Section>
      {user.isAdmin ? <MenuRow icon="megaphone" title="Ads Manager" text="Soulink team: sponsored posts, Spark ads, sponsored Argue" onPress={go('/ads')} tint={['#f5c842', '#ff9a5a']} /> : null}
      <MenuRow icon="information-circle" title="About" text="Soulink version, terms and privacy" onPress={go('/settings/about')} tint={['#b08fff', '#7c5cfc']} />
      <MenuRow icon="log-out-outline" title="Log out" danger
        onPress={async () => { if (await confirm('Log out?', undefined, { confirmText: 'Log out', destructive: true })) signOut(); }} />
      <Note>Signed in as {user.phone || user.email}</Note>
    </ScrollView>
    <ShopButton />
    </View>
  );
}
