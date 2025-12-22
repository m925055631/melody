
import React, { useEffect, useRef } from 'react';

// Using a royalty-free generic placeholder sound for demonstration
const DEFAULT_AUDIO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

interface AudioPlayerProps {
  isPlaying: boolean;
  volume: number;
  src?: string;
  onEnded?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ isPlaying, volume, src, onEnded }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioSrc = src || DEFAULT_AUDIO_URL;

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        // Reset play logic when source changes if needed, but HTML audio handles src change well usually
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log("Autoplay prevented or interrupted:", error);
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioSrc]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <audio 
      ref={audioRef} 
      src={audioSrc} 
      loop={false} 
      onEnded={onEnded}
    />
  );
};
