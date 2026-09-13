import { useEffect, useRef } from "react";

interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
  onPlay?: () => void;
}

export function AudioPlayer({ src, autoPlay = false, onPlay }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (autoPlay && audioRef.current) {
      void audioRef.current.play().catch(() => {
        /* autoplay may be blocked until user gesture */
      });
    }
  }, [src, autoPlay]);

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
