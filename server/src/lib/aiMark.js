// Marks an AI-made JPEG inside the file itself, as India's IT Rules (amended Feb 2026) ask for synthetic content:
// a visible label in the app AND metadata that travels with the image. We add an XMP block with the IPTC
// "digital source type" for AI-edited photos, plus a plain JPEG comment, right after the start-of-image marker.
// Soulink strips nothing else; the picture itself is unchanged.
const IPTC_AI_EDITED = 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia';
export const AI_NOTE = 'AI-generated: expression changed by Soulmoji on Soulink (QM46 Solutions). Not a real photo.';

function segment(marker, payload) {
  const len = payload.length + 2;
  if (len > 0xffff) throw new Error('JPEG segment too long');
  return Buffer.concat([Buffer.from([0xff, marker, len >> 8, len & 0xff]), payload]);
}

function xmp(note) {
  const x = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`
    + `<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/"`
    + ` Iptc4xmpExt:DigitalSourceType="${IPTC_AI_EDITED}" xmp:CreatorTool="Soulink Soulmoji">`
    + `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${note}</rdf:li></rdf:Alt></dc:description>`
    + '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="r"?>';
  return Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), Buffer.from(x, 'utf8')]);
}

/** Returns the JPEG with the AI marker added (or unchanged if it is not a JPEG or is already marked). */
export function markAiJpeg(buf, note = AI_NOTE) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  if (isAiMarked(buf)) return buf;
  return Buffer.concat([buf.subarray(0, 2), segment(0xe1, xmp(note)), segment(0xfe, Buffer.from(note, 'utf8')), buf.subarray(2)]);
}

/** True when the file carries Soulink's AI marker (used by tests and by anyone checking a download). */
export function isAiMarked(buf) {
  const head = buf.subarray(0, Math.min(buf.length, 8192)).toString('latin1');
  return head.includes('compositeWithTrainedAlgorithmicMedia');
}
