import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, uploadImage } from '../../lib/api';
import { usePhotoPicker } from '../../components/PhotoPicker';
import { notice } from '../../lib/confirm';
import { useAuth } from '../../lib/auth';
import ProfileHeader from '../../components/ProfileHeader';
import { PostGrid } from '../../components/PostCard';
import { Button, Empty, s } from '../../components/ui';
import { colors } from '../../lib/theme';

export default function MyProfile() {
  const { user, setUser } = useAuth();
  const [counts, setCounts] = useState(null);
  const [posts, setPosts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
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
        actions={<Button title="Edit profile" variant="secondary" style={{ flex: 1, height: 48 }} onPress={() => router.push('/edit-profile')} />}
      />
      {posts?.length ? <PostGrid posts={posts} /> : (
        <Empty icon="camera-outline" title="No posts yet" text="Share your first photo or thought.">
          <Button title="Create a post" icon="add-circle" onPress={() => router.push('/create-post')} />
        </Empty>
      )}
      {photo.sheet}
    </ScrollView>
  );
}
