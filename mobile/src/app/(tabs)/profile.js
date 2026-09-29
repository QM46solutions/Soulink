import { useCallback, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, uploadImage } from '../../lib/api';
import { usePhotoPicker } from '../../components/PhotoPicker';
import { notice } from '../../lib/confirm';
import { useAuth } from '../../lib/auth';
import ProfileHeader, { ProfileAction } from '../../components/ProfileHeader';
import { PostGrid } from '../../components/PostCard';
import { s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

export default function MyProfile() {
  const { user, setUser } = useAuth();
  const [counts, setCounts] = useState(null);
  const [posts, setPosts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const shareProfile = async () => {
    const message = `Find me on Soulink: @${user.username}`;
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ title: 'Soulink', text: message });
        else { await navigator.clipboard.writeText(message); notice('Copied', 'Your Soulink username is copied. Paste it anywhere to share.'); }
      } else await Share.share({ message });
    } catch { /* cancelled */ }
  };
  const savePhoto = async (fn) => { try { setUser((await fn()).user); } catch (e) { notice('Photo not saved', e.message); } };
  const photo = usePhotoPicker({
    onPicked: (uri) => savePhoto(() => uploadImage('/users/me/avatar', uri)),
    onRemove: () => savePhoto(() => api('/users/me/avatar', { method: 'DELETE' })),
    onError: (m) => notice('Photo', m),
    hasPhoto: !!user.avatarUrl,
  });

  const load = useCallback(async () => {
    try {
      const r = await api('/users/me');
      setUser(r.user); setCounts(r.counts);
      api(`/posts/user/${r.user.id}`).then((p) => setPosts(p.posts)).catch(() => {});
    } catch { /* offline: keep last data */ }
  }, [setUser]);

  useFocusEffect(useCallback(() => {
    navigation.setOptions({
      title: user.username,
      headerRight: () => (
        <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={{ marginRight: 16 }}>
          <Ionicons name="menu" size={24} color={colors.text} />
        </Pressable>
      ),
    });
    load();
  }, [load, navigation, user.username]));

  return (
    <ScrollView
      style={s.screen}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <ProfileHeader
        user={user}
        counts={counts}
        canViewLists
        onAvatarPress={photo.open}
        isMe
        actions={<>
          <ProfileAction title="Edit profile" onPress={() => router.push('/edit-profile')} />
          <ProfileAction title="Share profile" onPress={shareProfile} />
          <ProfileAction icon="person-add-outline" onPress={() => router.push('/discover')} style={{ flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: 38 }} />
        </>}
      />
      {posts?.length ? <PostGrid posts={posts} /> : (
        // Instagram-style empty state: outlined camera circle + a simple text link (no big button)
        <View style={{ alignItems: 'center', paddingTop: space.xxl, paddingHorizontal: space.xl }}>
          <Pressable onPress={() => router.push('/create-post')} accessibilityLabel="Create your first post"
            style={({ hovered }) => ({ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: hovered ? colors.aura : colors.text, alignItems: 'center', justifyContent: 'center', transform: [{ scale: hovered ? 1.05 : 1 }] })}>
            <Ionicons name="camera-outline" size={34} color={colors.text} />
          </Pressable>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text, marginTop: space.lg }}>Share your first moment</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 4, textAlign: 'center' }}>Photos and thoughts you share will appear on your profile.</Text>
          <Text onPress={() => router.push('/create-post')} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.aura, marginTop: space.md }}>Create your first post</Text>
        </View>
      )}
      {photo.sheet}
    </ScrollView>
  );
}
