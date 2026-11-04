// Phone-app build: joining clips runs in the Soulink web app for now (see joinClips.web.js).
export const TRANSITIONS = [['cut', 'Cut'], ['fade', 'Fade'], ['flash', 'Flash']];
export const canJoin = () => false;
export async function joinClips() { throw new Error('Joining clips works in the Soulink web app for now.'); }
