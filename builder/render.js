// Turns a Soulink Studio recipe into one ffmpeg command: the finished Spark (720×1280, 30 fps, H.264 + AAC).
// Clips are trimmed and sped up / slowed down, photos are shown for their seconds with a slow zoom, everything is
// joined, then the Soul Look, adjustments, crop / zoom and fades are applied, and the sound is mixed:
// the videos' own sound + the music (from its start point) + the voiceover. Text and stickers are NOT drawn here:
// the app shows them live on top of the video (so they stay sharp and can be tapped).
import { LOOKS, adjustFilters } from './looks.js';

export const W = 720; export const H = 1280; export const FPS = 30;
const r3 = (n) => Number(n).toFixed(3);
const clipLen = (c) => Math.max(0, (c.out - c.in) / (c.kind === 'photo' ? 1 : (c.speed || 1)));
/** atempo works between 0.5 and 2: chain it for other speeds (0.3 = 0.5 × 0.6) */
export function atempo(speed) {
  const out = []; let s = speed;
  while (s < 0.5) { out.push('atempo=0.5'); s /= 0.5; }
  while (s > 2) { out.push('atempo=2.0'); s /= 2; }
  if (Math.abs(s - 1) > 1e-3) out.push(`atempo=${r3(s)}`);
  return out;
}

/**
 * job = { clips: [{ file, kind, in, out, speed, hasAudio }], music?: { file, start, volume }, voice?: { file, volume },
 *         videoVolume, filter, adjust, zoom, fade }
 * returns { args, seconds } for: ffmpeg ...args <output.mp4>
 */
export function buildArgs(job, output) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  const graph = [];
  const total = job.clips.reduce((s, c) => s + clipLen(c), 0);
  job.clips.forEach((c) => {
    if (c.kind === 'photo') args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(clipLen(c)), '-i', c.file);
    else args.push('-i', c.file);
  });
  const n = job.clips.length;
  job.clips.forEach((c, i) => {
    const len = clipLen(c);
    if (c.kind === 'photo') {
      const frames = Math.max(1, Math.round(len * FPS));
      // fill the 9:16 frame, then a gentle 6 % zoom over the photo's time
      graph.push(`[${i}:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='1+0.06*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},trim=duration=${r3(len)},setsar=1,format=yuv420p[v${i}]`);
      graph.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${r3(len)}[a${i}]`);
    } else {
      const sp = c.speed || 1;
      graph.push(`[${i}:v]trim=start=${r3(c.in)}:end=${r3(c.out)},setpts=(PTS-STARTPTS)/${r3(sp)},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,fps=${FPS},setsar=1,format=yuv420p[v${i}]`);
      if (c.hasAudio) graph.push(`[${i}:a]atrim=start=${r3(c.in)}:end=${r3(c.out)},asetpts=PTS-STARTPTS,${[...atempo(sp), 'aresample=44100', 'aformat=sample_fmts=fltp:channel_layouts=stereo'].join(',')}[a${i}]`);
      else graph.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${r3(len)}[a${i}]`);
    }
  });
  graph.push(`${job.clips.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${n}:v=1:a=1[vc][ac]`);

  // the look, adjustments, crop / zoom and fades
  const vf = [...(LOOKS[job.filter] || []), ...adjustFilters(job.adjust)];
  const z = job.zoom;
  if (z && z.s > 1.001) vf.push(`crop=w=iw/${r3(z.s)}:h=ih/${r3(z.s)}:x=(iw-iw/${r3(z.s)})*${r3(z.x)}:y=(ih-ih/${r3(z.s)})*${r3(z.y)}`, `scale=${W}:${H}`);
  const f = job.fade || {};
  if (f.in) vf.push(`fade=t=in:st=0:d=${r3(f.in)}`);
  if (f.out) vf.push(`fade=t=out:st=${r3(Math.max(0, total - f.out))}:d=${r3(f.out)}`);
  graph.push(`[vc]${vf.length ? vf.join(',') : 'null'},format=yuv420p[vout]`);

  // sound: the clips' own sound, the music, the voiceover
  const mix = [`[ac]volume=${r3(job.videoVolume ?? 1)}[a_video]`];
  const parts = ['[a_video]'];
  let next = n;
  if (job.music?.file) {
    args.push('-ss', r3(job.music.start || 0), '-i', job.music.file);
    mix.push(`[${next}:a]atrim=duration=${r3(total)},asetpts=PTS-STARTPTS,aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${r3(job.music.volume ?? 1)}[a_music]`);
    parts.push('[a_music]'); next += 1;
  }
  if (job.voice?.file) {
    args.push('-i', job.voice.file);
    mix.push(`[${next}:a]atrim=duration=${r3(total)},asetpts=PTS-STARTPTS,aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${r3(job.voice.volume ?? 1)}[a_voice]`);
    parts.push('[a_voice]'); next += 1;
  }
  graph.push(...mix);
  const fadeA = [f.in ? `afade=t=in:st=0:d=${r3(f.in)}` : null, f.out ? `afade=t=out:st=${r3(Math.max(0, total - f.out))}:d=${r3(f.out)}` : null].filter(Boolean);
  graph.push(`${parts.join('')}amix=inputs=${parts.length}:duration=first:normalize=0,alimiter=limit=0.95${fadeA.length ? `,${fadeA.join(',')}` : ''}[aout]`);

  args.push('-filter_complex', graph.join(';'), '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-movflags', '+faststart', '-t', r3(total), output);
  return { args, seconds: total };
}
