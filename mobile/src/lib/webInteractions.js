// Web only: lists (FlatList) add more rows "after interactions" (InteractionManager). On the web, every running
// animation counts as an interaction, and Soulink has animations that loop forever (the twinkling stars, live icons,
// pulses), so "after interactions" never came: a list showed its first few rows and nothing more (Sparks blank from
// the 3rd one, the List view stuck at 3). On the web we run those tasks right away (next tick) instead.
import { InteractionManager, Platform } from 'react-native';

if (Platform.OS === 'web' && !InteractionManager.__soulinkPatched) {
  InteractionManager.__soulinkPatched = true;
  InteractionManager.runAfterInteractions = (task) => {
    let cancelled = false;
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (cancelled) return;
        try {
          const r = typeof task === 'function' ? task() : task && typeof task.run === 'function' ? task.run() : task && typeof task.gen === 'function' ? task.gen() : undefined;
          Promise.resolve(r).then(resolve, reject);
        } catch (e) { reject(e); }
      }, 0);
    });
    return { then: promise.then.bind(promise), done: promise.then.bind(promise), cancel: () => { cancelled = true; } };
  };
}
