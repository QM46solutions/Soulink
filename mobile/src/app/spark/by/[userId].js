// One person's Sparks, full screen (opened from the Sparks tab on their profile): starts at the one you tapped;
// swipe up / down for the rest, like the Sparks feed.
import { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { api } from '../../../lib/api';
import SparkCard from '../../../components/SparkCard';
import { Empty, Loading } from '../../../components/ui';

const web = Platform.OS === 'web';

export default function UserSparks() {
  const { userId, start, username } = useLocalSearchParams();
  const navigation = useNavigation();
  const [list, setList] = useState(null);
  const [pageH, setPageH] = useState(0);
  const [page, setPage] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { navigation.setOptions({ title: username ? `@${username} · Sparks` : 'Sparks' }); }, [navigation, username]);
  useEffect(() => {
    api(`/sparks/user/${userId}`).then((r) => {
      const all = r.sparks || [];
      setList(all);
      setPage(Math.max(0, all.findIndex((x) => x.id === start)));
    }).catch(() => setList([]));
  }, [userId, start]);

  if (list === null) return <Loading />;
  if (!list.length) return <Empty icon="film-outline" title="No Sparks" text="Nothing to show here." />;
  // the Spark at least ~70% on screen plays; mid-swipe (none of them that much on screen) nothing plays, so the one
  // you're leaving stops straight away instead of playing on under the next one
  const onScroll = (e) => { if (!pageH) return; const f = e.nativeEvent.contentOffset.y / pageH; const p = Math.round(f); const n = Math.abs(f - p) <= 0.3 ? p : -1; setPage((old) => (old === n ? old : n)); };
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setPageH(Math.round(e.nativeEvent.layout.height))}>
      <View style={{ flex: 1, width: '100%', maxWidth: web ? 520 : undefined, alignSelf: 'center' }}>
        {pageH ? (
          <FlatList
            ref={listRef}
            data={list}
            keyExtractor={(s) => s.id}
            renderItem={({ item, index }) => <SparkCard spark={item} variant="reel" height={pageH} active={index === page}
              onDeleted={(id) => setList((l) => { const n = l.filter((x) => x.id !== id); if (!n.length) router.back(); return n; })} />}
            initialScrollIndex={page}
            pagingEnabled
            snapToInterval={pageH}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: pageH, offset: pageH * i, index: i })}
            onScroll={onScroll}
            scrollEventThrottle={32}
            extraData={page}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            removeClippedSubviews={!web}
          />
        ) : null}
      </View>
    </View>
  );
}
