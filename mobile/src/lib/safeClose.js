// Sheets and dialogs open on the press of a button. With a mouse (web preview) the same click then lands on the
// sheet's dark background, which closes it again instantly. Ignore background taps for a moment after opening.
import { useEffect, useRef } from 'react';

export function useSafeClose(visible, onClose, guardMs = 400) {
  const openedAt = useRef(0);
  useEffect(() => { if (visible) openedAt.current = Date.now(); }, [visible]);
  return () => { if (Date.now() - openedAt.current > guardMs) onClose?.(); };
}

/** Same idea for the rows of a sheet: true once the sheet has been open long enough to accept a tap. */
export function useOpenGuard(visible, guardMs = 400) {
  const openedAt = useRef(0);
  useEffect(() => { if (visible) openedAt.current = Date.now(); }, [visible]);
  return () => Date.now() - openedAt.current > guardMs;
}
