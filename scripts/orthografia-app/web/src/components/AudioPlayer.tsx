import { useEffect, useRef } from "react";

interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
  /** Delay before autoplay (ms). Default 0. */
  autoPlayDelayMs?: number;
  onPlay?: () => void;
}

export function AudioPlayer({
  src,
  autoPlay = false,
  autoPlayDelayMs = 0,
  onPlay,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!autoPlay || !audioRef.current) return;

    const el = audioRef.current;
    const timer = window.setTimeout(() => {
      void el.play().catch(() => {
        /* autoplay may be blocked until user gesture */
      });
    }, Math.max(0, autoPlayDelayMs));

    return () => {
      window.clearTimeout(timer);
      el.pause();
      el.currentTime = 0;
    };
  }, [src, autoPlay, autoPlayDelayMs]);

  const replay = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play();
    onPlay?.();
  };

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="auto" />
      <button type="button" className="btn btn-audio pulse-on-mount" onClick={replay}>
        <span className="btn-icon" aria-hidden="true">
          🔊
        </span>
        Άκου ξανά
      </button>
    </div>
  );
}
