// A post or Spark opened from a shared link by someone who isn't logged in: that one post only (picture / video,
// caption, who posted it) for 15 seconds, then it blurs and asks them to log in to keep watching.
// Logged-in people are sent straight to the real post. Nothing else of Soulink is visible from here.
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { getServer } from '../lib/api';
import { isVideo } from './PostCard';
import PostVideo from './PostVideo';
import Watermark from './Watermark';
import { colors, fonts, gradients, space } from '../lib/theme';

/** /p/<id> or /s/<id> in the address bar → { kind, id } (web only) */
export function sharedLinkTarget() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const m = /^\/(p|s)\/([0-9a-fA-F-]{36})\/?$/.exec(window.location.pathname);
  return m ? { kind: m[1] === 'p' ? 'post' : 'spark', id: m[2] } : null;
}
const loggedIn = () => { try { return !!window.localStorage.getItem('soulink.token'); } catch { return false; } };
const abs = (u) => (!u ? null : /^https?:/.test(u) ? u : `${getServer()}${u}`);
const login = () => { window.location.href = '/'; };

export default function SharePreview({ target }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (loggedIn()) { window.location.replace(target.kind === 'post' ? `/post/${target.id}` : `/spark/${target.id}`); return; }
    fetch(`${getServer()}/share/${target.kind}/${target.id}`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || 'This post is not available.');
      setD(j); setLeft(j.previewSeconds || 15);
    }).catch((e) => setError(e.message));
  }, [target]);
  useEffect(() => {
    if (left == null || left <= 0) return undefined;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const over = left != null && left <= 0;
  const media = d ? (d.kind === 'post' ? d.media?.[0] : d.videoUrl) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
      <View style={{ width: '100%', maxWidth: 440 }}>
        {error ? (
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 16, textAlign: 'center' }}>{error}</Text>
        ) : !d ? (
          <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center' }}>Opening the post…</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
              {d.author.avatarUrl ? <Image source={{ uri: abs(d.author.avatarUrl) }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : null}
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>{d.author.displayName}</Text>
                <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>@{d.author.username} on Soulink</Text>
              </View>
              {!over ? <Text style={{ fontFamily: fonts.mono, color: colors.muted, fontSize: 12 }}>{left}s</Text> : null}
            </View>
            <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#000', aspectRatio: d.kind === 'spark' ? 9 / 14 : 1 }}>
              {media && !over ? (
                d.kind === 'spark' || isVideo(media)
                  ? (d.voice ? <Text style={{ color: colors.text, fontFamily: fonts.semibold, margin: space.xl, textAlign: 'center' }}>🎤 A voice post on Open Mic. Log in to listen.</Text>
                    : <PostVideo uri={abs(media)} />)
                  : <Image source={{ uri: abs(media) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : null}
              <Watermark label="Soulink preview" />
              {over ? (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: 'rgba(8,7,13,0.92)' }}>
                  <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 20, textAlign: 'center' }}>Log in to keep watching</Text>
                  <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, textAlign: 'center', marginTop: 6 }}>See the rest of {d.author.displayName}'s posts, react and comment on Soulink.</Text>
                  <Pressable onPress={login} style={{ marginTop: space.lg, height: 48, paddingHorizontal: 32, borderRadius: 24, overflow: 'hidden', justifyContent: 'center' }}>
                    <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                    <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>Log in or join Soulink</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            {d.caption && !over ? <Text numberOfLines={4} style={{ fontFamily: fonts.body, color: colors.text, fontSize: 14.5, lineHeight: 21, marginTop: space.md }}>{d.caption}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}
