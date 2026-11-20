// Settings › Account Data & Backup: Download My Data (a ZIP of your profile, posts, Sparks, photos and videos,
// prepared on the server, then saved where you choose), Restore My Data, Backup History, and how backups work.
// Leaving this screen never stops a backup being prepared: it is on the server, and shows here when you come back.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { notice } from '../../lib/confirm';
import { backupHistory, canSaveToFolder, downloadBackup, exportStatus, requestExport, saveBackupToDevice } from '../../lib/backup';
import { Button, ErrorText, s } from '../../components/ui';
import { InfoRow, Note, Section } from '../../components/SettingsUI';
import { Body, Card, CardTitle, Progress, Stat, day, mb } from '../../components/BackupUI';
import { colors, fonts, space } from '../../lib/theme';

const STATUS = { queued: 'Preparing', running: 'Preparing', ready: 'Ready', validated: 'Not confirmed', done: 'Completed', failed: 'Failed', expired: 'Expired', interrupted: 'Interrupted' };
const COLOR = { ready: colors.mint, done: colors.mint, failed: colors.danger, interrupted: colors.gold, expired: colors.dim };

export default function Backup() {
  const { user } = useAuth();
  const [job, setJob] = useState(null);          // the latest export
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState('idle');     // idle | preparing | ready | downloading | saved
  const [dl, setDl] = useState(null);             // download progress 0-1 (null = unknown)
  const [file, setFile] = useState(null);         // downloaded, waiting to be saved again
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const control = useRef(null);
  const poll = useRef(null);

  const load = useCallback(async () => {
    try {
      const h = (await backupHistory()).backups || [];
      setHistory(h);
      const last = h.find((b) => b.kind === 'export');
      if (last && ['queued', 'running'].includes(last.status)) { setJob(last); setPhase('preparing'); }
      else if (last && last.status === 'ready') { setJob(last); setPhase((p) => (p === 'downloading' || p === 'saved' ? p : 'ready')); }
    } catch { /* history is optional */ }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // while preparing: check every 2 s, and say so when it's ready
  useEffect(() => {
    if (phase !== 'preparing' || !job?.id) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const b = (await exportStatus(job.id)).backup;
        if (!alive) return;
        setJob(b);
        if (b.status === 'ready') { setPhase('ready'); notice('Your data is ready', `Your Soulink backup (${mb(b.sizeBytes)}) is ready to download. The link works until ${day(b.expiresAt)}.`); load(); return; }
        if (['failed', 'interrupted', 'expired'].includes(b.status)) { setPhase('idle'); setError(b.error || 'Preparing your backup stopped. Please request it again.'); load(); return; }
      } catch { /* try again on the next tick */ }
      poll.current = setTimeout(tick, 2000);
    };
    tick();
    return () => { alive = false; clearTimeout(poll.current); };
  }, [phase, job?.id, load]);

  const request = async () => {
    setError(null); setBusy(true);
    try { const r = await requestExport(); setJob(r.backup); setPhase('preparing'); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  const save = async (f) => {
    const r = await saveBackupToDevice(f);
    if (r.cancelled) { setFile(f); setPhase('ready'); setError(canSaveToFolder ? 'No folder chosen. Tap Save to device to choose one.' : null); return; }
    setFile(Platform.OS === 'android' ? null : f);
    setPhase('saved');
    notice('Backup saved', `Your Soulink backup was saved to ${r.where}. Keep it somewhere safe: it has your photos and videos.`);
  };

  const download = async () => {
    if (!job) return;
    setError(null); setDl(0); setPhase('downloading');
    try {
      const f = await downloadBackup(job, user?.username, (p) => setDl(p), control);
      await save(f);
    } catch (e) {
      setPhase('ready');
      setError(e.code === 'backup_expired' || e.code === 'backup_changed' ? e.message : e.message || 'The download failed. Please try again.');
      if (e.code === 'backup_expired') { setJob(null); setPhase('idle'); }
    }
  };

  const c = job?.counts;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 140 }}>
      <Section>Download My Data</Section>
      <Card>
        <CardTitle icon="download-outline">Download My Data</CardTitle>
        <Body>You can request a copy of your Soulink account data, including your profile information, posts, photos, videos and other information associated with your account.</Body>
        <Body style={{ marginTop: 8 }}>Once your request is processed, your data will be prepared as a downloadable file. You can save it to your phone storage or another location you choose.</Body>

        {phase === 'idle' && (
          <View style={{ marginTop: space.lg }}>
            <ErrorText>{error}</ErrorText>
            <Button title="Request My Data" icon="cloud-download-outline" onPress={request} loading={busy} />
          </View>
        )}

        {phase === 'preparing' && (
          <>
            <Progress value={job?.progress != null ? job.progress / 100 : null} label={job?.stage || 'Preparing your data'} />
            <Body style={{ marginTop: space.sm }}>You can leave this screen: we'll keep preparing it, and it will be here when you come back.</Body>
          </>
        )}

        {(phase === 'ready' || phase === 'downloading' || phase === 'saved') && job && (
          <View style={{ marginTop: space.md }}>
            {c ? (
              <View style={{ marginBottom: space.sm }}>
                <Stat icon="images-outline" label="Posts" value={c.posts} />
                <Stat icon="flash-outline" label="Sparks" value={c.sparks} />
                <Stat icon="image-outline" label="Photos" value={c.photos} />
                <Stat icon="videocam-outline" label="Videos" value={c.videos} />
                <Stat icon="document-outline" label="Backup size" value={mb(job.sizeBytes)} />
              </View>
            ) : null}
            <Body>Ready since {day(job.finishedAt)}. You can download it until {day(job.expiresAt)}.</Body>
            {phase === 'downloading' ? (
              <>
                <Progress value={dl} label="Downloading your backup" />
                <View style={{ marginTop: space.md }}><Button title="Cancel" variant="ghost" small onPress={() => control.current?.cancel()} /></View>
              </>
            ) : (
              <View style={{ marginTop: space.lg }}>
                <ErrorText>{error}</ErrorText>
                {file && phase !== 'downloading'
                  ? <Button title="Save to device" icon="save-outline" onPress={() => save(file).catch((e) => setError(e.message))} />
                  : <Button title={phase === 'saved' ? 'Download again' : 'Download & save'} icon="download-outline" onPress={download} />}
                {phase === 'saved' && file ? <View style={{ marginTop: space.sm }}><Button title="Download again" variant="ghost" small onPress={download} /></View> : null}
                <Body style={{ marginTop: space.sm, fontSize: 12.5 }}>
                  {Platform.OS === 'android' ? 'You will choose the folder to save it in (for example Downloads or Documents).'
                    : Platform.OS === 'ios' ? 'Choose "Save to Files" to keep it on your iPhone or in iCloud Drive.' : 'Your browser will save it to Downloads.'}
                </Body>
              </View>
            )}
          </View>
        )}
      </Card>

      <Section>Restore My Data</Section>
      <Card>
        <CardTitle icon="cloud-upload-outline">Restore My Data</CardTitle>
        <Body>Have a previous Soulink backup? Choose your backup file to restore your posts, photos, videos and supported account information.</Body>
        <View style={{ marginTop: space.lg }}>
          <Button title="Choose Backup File" icon="folder-open-outline" variant="secondary" onPress={() => router.push('/settings/restore-data')} />
        </View>
      </Card>

      <Section>Backup History</Section>
      {history.length ? history.map((b) => (
        <InfoRow key={b.id} icon={b.kind === 'export' ? 'download-outline' : 'cloud-upload-outline'}
          title={`${b.kind === 'export' ? 'Download' : 'Restore'} · ${day(b.createdAt)}${b.sizeBytes ? ` · ${mb(b.sizeBytes)}` : ''}`}
          value={STATUS[b.status] || b.status} color={COLOR[b.status] || colors.muted} />
      )) : <Note>No backups yet.</Note>}

      <Section>About data backup</Section>
      <Note>Your backup is a ZIP file with your profile, your posts and Sparks with their original photos and videos, captions and dates, your Moments that are still up, and the likes and comments you made. It is checked with a fingerprint, so a changed or damaged file is refused when you restore it.</Note>
      <Note>Other people's likes and comments on your posts are not copied into your file (only their counts). When you restore, they come back only from people who are still your Connections, still active on Soulink, and not blocked. Others are left out and the counts are updated.</Note>
      <Note>Restoring never deletes or overwrites anything newer on your account, and never creates duplicates: posts that are already here are skipped.</Note>
      <Note>Face data, passwords and login codes are never part of a backup. The download link only works for you, and stops working after 7 days. Your backup file is yours: keep it somewhere safe, as anyone with the file can see what's in it.</Note>
    </ScrollView>
  );
}
