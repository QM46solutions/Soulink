// One Spark on its own page (opened from a chat or a notification), with all its actions.
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import SparkCard from '../../components/SparkCard';
import { Empty, Loading, s } from '../../components/ui';
import { space } from '../../lib/theme';

export default function SparkPage() {
  const { id } = useLocalSearchParams();
  const [spark, setSpark] = useState(undefined);
  useEffect(() => { api(`/sparks/${id}`).then((r) => setSpark(r.spark)).catch(() => setSpark(null)); }, [id]);
  if (spark === undefined) return <Loading />;
  if (!spark) return <Empty icon="film-outline" title="Spark not available" text="It may have been deleted, or it's from a private account." />;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingTop: space.md, paddingBottom: 80 }}>
      <SparkCard spark={spark} onDeleted={() => router.back()} />
    </ScrollView>
  );
}
