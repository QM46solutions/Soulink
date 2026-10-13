// A video in a post (browser). thumb = small muted preview for grids.
export default function PostVideo({ uri, thumb, style }) {
  return (
    <video src={uri} playsInline controls={!thumb} muted={!!thumb} preload="metadata" loop={!thumb}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', backgroundColor: '#000', ...(style || {}) }} />
  );
}
