// Settings › Account Data & Backup › Restore My Data.
// 1. Choose the backup file (phone file picker / browser). 2. It is uploaded and checked on the server: a genuine,
// unchanged Soulink backup of this account (its verified email or phone), a supported format. 3. A summary of what
// will happen; nothing changes until "Restore My Data". 4. Progress by stage. 5. What was restored.
// Older "Download my data" .json files still work: they bring back the profile and Soul DNA, as before.
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { confirm } from '../../lib/confirm';
import { pickBackupFile, readLegacyJson, restoreLegacy, restoreStatus, startRestore, uploadBackupForCheck } from '../../lib/backup';
import { Button, ErrorText, s } from '../../components/ui';
import { Body, Card, CardTitle, Progress, Stat, day, mb } from '../../components/BackupUI';
import { colors, fonts, space } from '../../lib/theme';

const LEGACY = { profile: 'profile details', username: 'username', soulDna: 'Soul DNA' };

export default function RestoreData() {
  const { refresh, setUser } = useAuth();
  const [step, setStep] = useState('choose');   // choose | uploading | summary | restoring | done | legacyDone
  const [picked, setPicked] = useState(null);
  const [up, setUp] = useState(0);
  const [check, setCheck] = useState(null);      // { restore, backup, summary }
  const [job, setJob] = useState(null);
  const [legacy, setLegacy] = useState(null);
  const [error, setError] = useState(null);
  const control = useRef(null);

  const choose = async () => {
    setError(null);
    let f;
    try { f = await pickBackupFile(); } catch { setError("Couldn't open your files. Please try again."); return; }
    if (!f) return;
    setPicked(f);
    if (f.kind === 'json') {
      // the earlier JSON download: profile and Soul DNA only
      setStep('uploading'); setUp(null);
      try { const r = await restoreLegacy(await readLegacyJson(f)); if (r.user) setUser(r.user); setLegacy(r.restored || []); setStep('legacyDone'); }
      catch (e) { setError(e.message); setStep('choose'); }
      return;
    }
    if (f.size && f.size > 320 * 1024 * 1024) { setError('This file is larger than a Soulink backup can be (300 MB).'); return; }
    setStep('uploading'); setUp(0);
    try { const r = await uploadBackupForCheck(f, setUp, control); setCheck(r); setStep('summary'); }
    catch (e) { setError(e.message); setStep('choose'); }
  };

  const go = async () => {
    const ok = await confirm('Restore your data?', 'Posts and photos from your backup that are missing will be added to your account. Nothing newer on your account is changed or deleted.', { confirmText: 'Restore My Data' });
    if (!ok) return;
    setError(null);
    try { const r = await startRestore(check.restore.id); setJob(r.restore); setStep('restoring'); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => {
    if (step !== 'restoring' || !job?.id) return undefined;
    let alive = true; let t;
    const tick = async () => {
      try {
        const r = (await restoreStatus(job.id)).restore;
        if (!alive) return;
        setJob(r);
        if (r.status === 'done') { refresh?.().catch?.(() => {}); setStep('done'); return; }
        if (['failed', 'interrupted', 'expired'].includes(r.status)) { setError(r.error || r.stage || 'The restore stopped. Choose the backup file again to continue: anything already restored is kept and is not duplicated.'); setStep('choose'); return; }
      } catch { /* next tick */ }
      t = setTimeout(tick, 1500);
    };
    tick();
    return () => { alive = false; clearTimeout(t); };
  }, [step, job?.id, refresh]);

  const sm = check?.summary;
  const res = job?.result;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 140 }}>
      {step === 'choose' && (
        <Card style={{ marginTop: space.lg }}>
          <CardTitle icon="cloud-upload-outline">Restore My Data</CardTitle>
          <Body>Have a previous Soulink backup? Choose your backup file to restore your posts, photos, videos and supported account information.</Body>
          <Body style={{ marginTop: 8 }}>Use the ZIP file exactly as Soulink gave it to you. It must belong to this account: it is checked against your verified email or phone number.</Body>
          <View style={{ marginTop: space.lg }}>
            <ErrorText>{error}</ErrorText>
            <Button title="Choose Backup File" icon="folder-open-outline" onPress={choose} />
          </View>
        </Card>
      )}

      {step === 'uploading' && (
        <Card style={{ marginTop: space.lg }}>
          <CardTitle icon="shield-checkmark-outline">Checking your backup</CardTitle>
          <Body>{picked?.name}{picked?.size ? ` · ${mb(picked.size)}` : ''}</Body>
          <Progress value={up} label={up === 1 ? 'Checking it is genuine and complete…' : 'Uploading your backup'} />
          {up !== 1 && up !== null ? <View style={{ marginTop: space.md }}><Button title="Cancel" variant="ghost" small onPress={() => control.current?.cancel()} /></View> : null}
        </Card>
      )}

      {step === 'summary' && sm && (
        <Card style={{ marginTop: space.lg }}>
          <CardTitle icon="checkmark-circle-outline" color={colors.mint}>Your backup is genuine</CardTitle>
          <Body>Made on {day(check.backup?.exportedAt)}. This is what restoring will do:</Body>
          <View style={{ marginTop: space.sm }}>
            <Stat icon="images-outline" label="Posts and Sparks to add" value={sm.postsToRestore} />
            <Stat icon="image-outline" label="Photos" value={sm.photosToRestore} />
            <Stat icon="videocam-outline" label="Videos" value={sm.videosToRestore} />
            {sm.postsBroughtBack ? <Stat icon="refresh-outline" label="Deleted posts brought back" value={sm.postsBroughtBack} /> : null}
            {sm.likesEligible || sm.commentsEligible ? <Stat icon="heart-outline" label="Likes and comments kept" value={sm.likesEligible + sm.commentsEligible} /> : null}
            {sm.profileFieldsToFill ? <Stat icon="person-outline" label="Empty profile details filled in" value={sm.profileFieldsToFill} /> : null}
            {sm.soulDna ? <Stat icon="sparkles-outline" label="Soul DNA" value="Yes" /> : null}
            <Stat icon="copy-outline" label="Already on your account (skipped)" value={sm.duplicatesSkipped} color={colors.muted} />
            {sm.interactionsExcluded ? <Stat icon="eye-off-outline" label="Likes and comments left out" value={sm.interactionsExcluded} color={colors.muted} /> : null}
            {sm.removedByModeration ? <Stat icon="alert-circle-outline" label="Removed for breaking the rules (not restored)" value={sm.removedByModeration} color={colors.muted} /> : null}
          </View>
          {sm.interactionsExcluded ? <Body style={{ marginTop: space.sm, fontSize: 12.5 }}>Likes and comments come back only from people who are still your Connections, still active and not blocked.</Body> : null}
          {(sm.conflicts || []).map((c, i) => <Body key={i} style={{ marginTop: 6, fontSize: 12.5, color: colors.gold }}>{c}</Body>)}
          <View style={{ marginTop: space.lg }}>
            <ErrorText>{error}</ErrorText>
            {sm.postsToRestore || sm.postsBroughtBack || sm.profileFieldsToFill || sm.soulDna
              ? <Button title="Restore My Data" icon="cloud-upload-outline" onPress={go} />
              : <Body style={{ color: colors.text }}>Everything in this backup is already on your account. There's nothing to restore.</Body>}
            <View style={{ marginTop: space.sm }}><Button title="Cancel" variant="ghost" small onPress={() => { setCheck(null); setStep('choose'); }} /></View>
          </View>
        </Card>
      )}

      {step === 'restoring' && (
        <Card style={{ marginTop: space.lg }}>
          <CardTitle icon="sync-outline">Restoring your data</CardTitle>
          <Body>Please keep Soulink open. If you leave, the restore keeps going on our side.</Body>
          <Progress value={job?.progress != null ? job.progress / 100 : null} label={job?.stage || 'Starting'} />
        </Card>
      )}

      {step === 'done' && (
        <Card style={{ marginTop: space.lg }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text, lineHeight: 28 }}>Your Soulink Data Has Been Restored!</Text>
          {res ? (
            <View style={{ marginTop: space.md }}>
              <Stat icon="images-outline" label="Posts restored" value={res.postsRestored + (res.broughtBack || 0)} />
              <Stat icon="flash-outline" label="Sparks restored" value={res.sparksRestored} />
              <Stat icon="image-outline" label="Photos restored" value={res.photosRestored} />
              <Stat icon="videocam-outline" label="Videos restored" value={res.videosRestored} />
              <Stat icon="heart-outline" label="Likes restored" value={res.likesRestored} />
              <Stat icon="chatbubble-outline" label="Comments restored" value={res.commentsRestored} />
              <Stat icon="eye-off-outline" label="Interactions skipped" value={res.interactionsSkipped} color={colors.muted} />
              <Stat icon="copy-outline" label="Duplicates skipped" value={res.duplicatesSkipped} color={colors.muted} />
              {res.notRecovered?.length ? <Body style={{ marginTop: space.sm, color: colors.gold }}>Couldn't be restored: {res.notRecovered.join(', ')}.</Body> : null}
            </View>
          ) : null}
          <View style={{ marginTop: space.lg }}><Button title="Go to My Profile" icon="person-circle-outline" onPress={() => router.replace('/(tabs)/profile')} /></View>
        </Card>
      )}

      {step === 'legacyDone' && (
        <Card style={{ marginTop: space.lg }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>Welcome back</Text>
          <Body style={{ marginTop: 8 }}>{legacy?.length ? `Restored your ${legacy.map((k) => LEGACY[k] || k).join(', ')} from your earlier Soulink download.` : 'Nothing in that file needed restoring.'}</Body>
          <Body style={{ marginTop: 8 }}>Older downloads (.json) don't contain photos or videos. New backups from Download My Data do.</Body>
          <View style={{ marginTop: space.lg }}><Button title="Go to My Profile" icon="person-circle-outline" onPress={() => router.replace('/(tabs)/profile')} /></View>
        </Card>
      )}
    </ScrollView>
  );
}
