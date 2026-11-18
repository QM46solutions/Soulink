// Settings > Saved (only you see what you saved) and Settings > Archive (your archived posts), one screen each.
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { PostGrid } from '../../components/PostCard';
import { Note } from '../../components/SettingsUI';
import { Empty, ErrorText, s } from '../../components/ui';

export default function SavedOrArchive() {
  const { kind } = useLocalSearchParams();
  const archive = kind === 'archive';
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  useFocusEffect(useCallback(() => {
    api(archive ? '/posts/archived' : '/posts/saved').then((r) => setPosts(r.posts)).catch((e) => setError(e.message));
  }, [archive]));
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: archive ? 'Archive' : 'Saved' }} />
      <ErrorText>{error}</ErrorText>
      {posts && !posts.length
        ? <Empty icon={archive ? 'archive-outline' : 'bookmark-outline'} title={archive ? 'Nothing archived' : 'Nothing saved yet'}
            text={archive ? 'Archive a post from its ··· menu to hide it from your profile without deleting it.' : 'Tap ··· › Save on any post to keep it here.'} />
        : <PostGrid posts={posts || []} />}
      {posts?.length ? <Note>{archive ? 'Only you can see these. Open one and tap ··· › Show on profile to bring it back.' : 'Only you can see what you saved.'}</Note> : null}
    </ScrollView>
  );
}
