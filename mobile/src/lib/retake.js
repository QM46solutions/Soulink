// "Retake Soul DNA" (Settings menu and the Soul DNA result screen). Your first Soul DNA is free; retaking it is Premium.
import { router } from 'expo-router';
import { api } from './api';
import { confirm, notice } from './confirm';

export async function retakeSoulDna(user) {
  if (!user?.isPremium) {
    notice('Retake Soul DNA 💎', 'Retaking your Soul DNA is a Soulink Premium feature. Premium is coming soon: you will be able to start your Soul DNA again any time your life changes.');
    return;
  }
  const ok = await confirm('Retake your Soul DNA?', 'You answer every question again. Your current Soul DNA and matches stay until you finish the new one.', { confirmText: 'Start again' });
  if (!ok) return;
  try { await api('/soul/dna/retake', { method: 'POST' }); router.push({ pathname: '/soul', params: { retake: '1' } }); }
  catch (e) { notice('Retake Soul DNA', e.message); }
}
