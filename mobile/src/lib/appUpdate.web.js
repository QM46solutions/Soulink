// Web: there is no store app to update and the page always loads the latest code, so these do nothing.
export function useAppUpdate() {}
export const installedVersion = 'web';
export const isStoreApp = false;
export function compareVersions() { return 0; }
export async function checkStoreVersion() { return { status: 'unsupported' }; }
export async function openStore() { return false; }
export async function checkOtaUpdate() { return { available: false, supported: false }; }
export async function downloadOtaUpdate() { return false; }
export async function applyOtaUpdate() {}
export function checkMinimumOnStart() { return Promise.resolve(null); }
