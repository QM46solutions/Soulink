// Tracks when real people last used Soulink, and whether the database is up.
// Background timers only touch the database while people are active, so the free cloud database
// (which pauses itself after an hour without queries) can sleep when nobody is using the app.
let lastActivity = 0;
export const markActivity = () => { lastActivity = Date.now(); };
export const recentlyActive = (ms = 65 * 60_000) => Date.now() - lastActivity < ms;

// Ready by default (laptop + tests start the database before the server). The cloud boot marks it
// "starting" and opens the web server straight away; API calls wait until the database is ready.
let ready = true;
let readyPromise = Promise.resolve();
let resolveReady = () => {};
export const isDbReady = () => ready;
export const waitDbReady = () => readyPromise;
export function markDbStarting() { ready = false; readyPromise = new Promise((r) => { resolveReady = r; }); }
export function setDbReady() { ready = true; resolveReady(); }
