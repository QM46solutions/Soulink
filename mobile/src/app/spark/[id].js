// One Spark on its own page (opened from a chat or a notification): full screen, like the Sparks feed.
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import SparkCard from '../../components/SparkCard';
import { Empty, Loading } from '../../components/ui';

export default function SparkPage() {
  const { id } = useLocalSearchParams();
  const [spark, setSpark] = useState(undefined);
  const [h, setH] = useState(0);
  useEffect(() => { api(`/sparks/${id}`).then((r) => setSpark(r.spark)).catch(() => setSpark(null)); }, [id]);
  if (spark === undefined) return <Loading />;
  if (!spark) return <Empty icon="film-outline" title="Spark not available" text="It may have been deleted, or it's from a private account." />;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setH(Math.round(e.nativeEvent.layout.height))}>
      <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 520 : undefined, alignSelf: 'center' }}>
        {h ? <SparkCard spark={spark} variant="reel" height={h} active onDeleted={() => router.back()} /> : null}
      </View>
    </View>
  );
}
