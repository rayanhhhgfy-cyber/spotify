import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { recordPlay, resolveFullLengthStream } from '../api';

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  playSong: (song: Song, newQueue?: Song[]) => void;
  shufflePlay: (songs: Song[]) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [activeEngine, setActiveEngine] = useState<'youtube' | 'audio'>('audio');

  const audioRef = useRef<HTMLAudioElement>(null);
  const silentAudioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const playPromiseRef = useRef<Promise<void> | void>();
  const currentSongRef = useRef<Song | null>(null);
  const currentMirrorIndexRef = useRef<number>(0);
  const repeatModeRef = useRef<'off' | 'all' | 'one'>('all');
  const isPlayingRef = useRef<boolean>(false);
  const userInitiatedPauseRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const prewarmedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // Keep iOS / Android / Desktop audio session actively authorized in background
  const ensureAudioSessionActive = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      }
    } catch (e) {}

    if (silentAudioRef.current && silentAudioRef.current.paused) {
      silentAudioRef.current.play().catch(() => {});
    }
  };

  const pauseAudioSession = () => {
    if (silentAudioRef.current && !silentAudioRef.current.paused) {
      silentAudioRef.current.pause();
    }
  };

  // Sync isPlaying state to ref and media session
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch (e) {}
    }
    if (isPlaying) {
      ensureAudioSessionActive();
    } else {
      pauseAudioSession();
    }
  }, [isPlaying]);

  // WakeLock: prevent device sleep while app is open and playing
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isPlaying && document.visibilityState === 'visible') {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (e) {}
      }
    };
    if (isPlaying) {
      requestWakeLock();
    } else if (wakeLock) {
      wakeLock.release().catch(() => {});
    }
    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [isPlaying]);

  // Pre-warm the next track's stream 15 seconds before the current track finishes
  const prewarmNextTrack = () => {
    if (!currentSongRef.current || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSongRef.current?.id);
    const nextTrack = isShuffle
      ? queue[Math.floor(Math.random() * queue.length)]
      : (idx !== -1 && idx < queue.length - 1 ? queue[idx + 1] : queue[0]);

    if (nextTrack && nextTrack.youtubeId && prewarmedTrackIdRef.current !== nextTrack.youtubeId) {
      prewarmedTrackIdRef.current = nextTrack.youtubeId;
      fetch(`/api/stream/youtube/${nextTrack.youtubeId}`, {
        headers: { Range: 'bytes=0-100' }
      }).catch(() => {});
    }
  };

  // Keep track of latest functions for MediaSession, events, and shortcuts
  const handlersRef = useRef({
    togglePlay: () => {},
    nextSong: () => {},
    prevSong: () => {},
    seek: (_t: number) => {}
  });

  // Handle visibility changes (phone locked / closed / tab backgrounded on iPhone, Android, Windows, Mac)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App backgrounded or phone locked: Ensure background audio session stays active
        if (isPlayingRef.current) {
          ensureAudioSessionActive();
          if (audioRef.current && audioRef.current.paused && !userInitiatedPauseRef.current) {
            audioRef.current.play().catch(() => {});
          }
        }
      } else if (document.visibilityState === 'visible') {
        // Returned to app / unlocked: sync UI with current audio state
        if (isPlayingRef.current && audioRef.current) {
          if (audioRef.current.paused && !userInitiatedPauseRef.current) {
            audioRef.current.play().catch(() => {});
          }
          if (typeof audioRef.current.currentTime === 'number' && !isNaN(audioRef.current.currentTime)) {
            setProgress(audioRef.current.currentTime);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Initialize YouTube IFrame API
  useEffect(() => {
    const initYT = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        if (!ytPlayerRef.current) {
          try {
            ytPlayerRef.current = new (window as any).YT.Player('yt-audio-player', {
              height: '180',
              width: '240',
              playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                rel: 0,
                playsinline: 1,
                enablejsapi: 1,
                origin: window.location.origin
              },
              events: {
                onReady: () => {
                  ytReadyRef.current = true;
                  if (ytPlayerRef.current?.setVolume) {
                    ytPlayerRef.current.setVolume(volume * 100);
                  }
                },
                onStateChange: (event: any) => {
                  // event.data: 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
                  if (event.data === 1) {
                    setIsPlaying(true);
                    userInitiatedPauseRef.current = false;
                  } else if (event.data === 2) {
                    if (userInitiatedPauseRef.current) {
                      setIsPlaying(false);
                    } else if (document.visibilityState === 'hidden' && isPlayingRef.current) {
                      setTimeout(() => {
                        try {
                          if (isPlayingRef.current && ytPlayerRef.current?.getPlayerState?.() === 2) {
                            ytPlayerRef.current?.playVideo();
                          }
                        } catch (e) {}
                      }, 200);
                    } else {
                      setIsPlaying(false);
                    }
                  } else if (event.data === 0) {
                    if (repeatModeRef.current === 'one') {
                      ytPlayerRef.current.seekTo(0, true);
                      ytPlayerRef.current.playVideo();
                    } else {
                      handlersRef.current.nextSong();
                    }
                  }
                },
                onError: (event: any) => {
                  console.warn('YouTube Player Error code:', event.data);
                  handleYouTubePlaybackError(event.data);
                }
              }
            });
          } catch (e) {
            console.warn('Failed to init YT player:', e);
          }
        }
      }
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initYT();
    } else {
      (window as any).onYouTubeIframeAPIReady = initYT;
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlersRef.current.togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) handlersRef.current.nextSong();
          else handlersRef.current.seek(progress + 10);
          break;
        case 'ArrowLeft':
          if (e.shiftKey) handlersRef.current.prevSong();
          else handlersRef.current.seek(Math.max(0, progress - 10));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [progress]);

  // High-precision playback progress polling for YouTube Engine
  useEffect(() => {
    if (activeEngine !== 'youtube' || !isPlaying) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        try {
          const cur = ytPlayerRef.current.getCurrentTime();
          const dur = ytPlayerRef.current.getDuration();
          if (typeof cur === 'number' && !isNaN(cur)) {
            setProgress(cur);
          }
          if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
            setDuration(dur);
          }
        } catch (e) {}
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeEngine, isPlaying]);

  const reorderQueue = (startIndex: number, endIndex: number) => {
    setQueue(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const handleAudioError = () => {
    if (!currentSongRef.current) return;
    const song = currentSongRef.current;
    const candidates = song.streamMirrors && song.streamMirrors.length > 0 ? song.streamMirrors : [song.audioUrl];

    if (currentMirrorIndexRef.current + 1 < candidates.length) {
      currentMirrorIndexRef.current += 1;
      const nextUrl = candidates[currentMirrorIndexRef.current];
      if (nextUrl && audioRef.current) {
        audioRef.current.src = nextUrl;
        audioRef.current.load();
        safePlay();
        return;
      }
    }

    // If direct audio stream failed and song has a youtubeId, fallback to YouTube engine
    if (song.youtubeId && navigator.onLine) {
      console.log(`Audio stream failed for "${song.title}", switching to YouTube engine fallback`);
      setActiveEngine('youtube');
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(true);
      if (ytPlayerRef.current?.loadVideoById) {
        try {
          ytPlayerRef.current.loadVideoById(song.youtubeId);
          ytPlayerRef.current.playVideo();
          return;
        } catch (e) {}
      }
    }

    console.warn(`All stream sources for "${song.title}" were unavailable. Skipping to next song.`);
    handlersRef.current.nextSong();
  };

  const handleYouTubePlaybackError = (_errorCode?: any) => {
    const song = currentSongRef.current;
    if (!song) return;

    // 1. If backup YouTube IDs are available for the exact same track, try them
    if (song.backupYoutubeIds && song.backupYoutubeIds.length > 0) {
      const nextYtId = song.backupYoutubeIds.shift();
      if (nextYtId) {
        console.log(`Trying alternate video for "${song.title}": ${nextYtId}`);
        song.youtubeId = nextYtId;
        if (ytPlayerRef.current?.loadVideoById) {
          try {
            ytPlayerRef.current.loadVideoById(nextYtId);
            ytPlayerRef.current.playVideo();
            return;
          } catch (e) {
            console.warn('Backup YT play error:', e);
          }
        }
      }
    }

    // 2. Fallback to HTML5 audio stream if valid mirror exists
    const candidates = song.streamMirrors && song.streamMirrors.length > 0 ? song.streamMirrors : (song.audioUrl ? [song.audioUrl] : []);
    const validStream = candidates.find(c => c && !c.startsWith('/api/stream/youtube'));
    if (validStream) {
      console.log(`Falling back to audio stream for "${song.title}"`);
      setActiveEngine('audio');
      if (audioRef.current) {
        audioRef.current.src = validStream;
        audioRef.current.load();
        safePlay();
        return;
      }
    }

    // 3. Only if all alternatives for this song fail, move to next
    console.warn(`Could not play "${song.title}", advancing to next track`);
    handlersRef.current.nextSong();
  };

  const safePlay = () => {
    if (!audioRef.current) return;
    try {
      const promise = audioRef.current.play();
      if (promise !== undefined) {
        playPromiseRef.current = promise;
        promise.catch((e: any) => {
          if (e.name === 'NotAllowedError') {
            setIsPlaying(false);
            return;
          }
          if (e.name === 'AbortError') return;
          if (e.name === 'NotSupportedError') {
            handleAudioError();
            return;
          }
          console.warn('Playback warning:', e.message || e);
        });
      }
    } catch (e) {
      console.warn('Sync play error:', e);
    }
  };

  const startPlayback = async (song: Song) => {
    recordPlay(song);
    setCurrentSong(song);
    currentSongRef.current = song;
    currentMirrorIndexRef.current = 0;
    setProgress(0);
    setDuration(song.duration ? song.duration / 1000 : 200);

    let targetSong = { ...song };

    // Resolve full-length stream if no youtubeId or if it has an iTunes 30s preview
    const is30sPreview = !targetSong.youtubeId && (
      !targetSong.audioUrl ||
      targetSong.id.startsWith('itunes-') ||
      targetSong.duration <= 30000 ||
      (targetSong.audioUrl && (targetSong.audioUrl.includes('apple.com') || targetSong.audioUrl.includes('mzstatic')))
    );

    if (is30sPreview || !targetSong.youtubeId) {
      const resolved = await resolveFullLengthStream(targetSong.title, targetSong.artist);
      if (resolved) {
        if (resolved.youtubeId) {
          targetSong.youtubeId = resolved.youtubeId;
          targetSong.backupYoutubeIds = resolved.backupYoutubeIds || [];
        }
        if (resolved.audioUrl && !resolved.audioUrl.startsWith('/api/stream/youtube')) {
          targetSong.audioUrl = resolved.audioUrl;
          targetSong.streamMirrors = resolved.mirrors;
        }
        if (resolved.duration) {
          targetSong.duration = resolved.duration;
          setDuration(resolved.duration / 1000);
        }
        targetSong.isFullLength = true;
        setCurrentSong(targetSong);
        currentSongRef.current = targetSong;
      }
    }

    if (targetSong.youtubeId && !targetSong.audioUrl) {
      targetSong.audioUrl = `/api/stream/youtube/${targetSong.youtubeId}`;
    }

    // 1. If song has youtubeId, configure audio stream endpoint and mirrors
    if (targetSong.youtubeId) {
      const streamEndpoint = `/api/stream/youtube/${targetSong.youtubeId}`;
      if (!targetSong.audioUrl || targetSong.audioUrl.includes('apple.com') || targetSong.audioUrl.includes('mzstatic')) {
        targetSong.audioUrl = streamEndpoint;
      }
      const existingMirrors = targetSong.streamMirrors || [];
      const backupMirrors = (targetSong.backupYoutubeIds || []).map(bId => `/api/stream/youtube/${bId}`);
      targetSong.streamMirrors = Array.from(new Set([targetSong.audioUrl, streamEndpoint, ...existingMirrors, ...backupMirrors]));
    }

    // 2. PRIMARY: HTML5 Audio Engine for continuous 24/7 background playback across iPhone, Android, Windows, Mac, Linux
    setActiveEngine('audio');
    if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
    }
    userInitiatedPauseRef.current = false;
    setIsPlaying(true);

    if (audioRef.current && targetSong.audioUrl) {
      const candidates = targetSong.streamMirrors && targetSong.streamMirrors.length > 0 ? targetSong.streamMirrors : [targetSong.audioUrl];
      const validStream = candidates[0] || targetSong.audioUrl;
      audioRef.current.src = validStream;
      audioRef.current.load();
      safePlay();
    }
  };

  const playSong = (song: Song, newQueue: Song[] = []) => {
    ensureAudioSessionActive();
    if (newQueue.length > 0) {
      setQueue(newQueue);
    } else if (queue.length === 0) {
      setQueue([song]);
    }
    startPlayback(song);
  };

  const shufflePlay = (songs: Song[]) => {
    if (!songs || songs.length === 0) return;
    ensureAudioSessionActive();
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setIsShuffle(true);
    setQueue(shuffled);
    startPlayback(shuffled[0]);
  };

  const _playDirectly = (song: Song) => {
    ensureAudioSessionActive();
    startPlayback(song);
  };

  const togglePlay = () => {
    if (!currentSong) return;

    if (isPlaying) {
      userInitiatedPauseRef.current = true;
      setIsPlaying(false);
      pauseAudioSession();
      if (activeEngine === 'youtube') {
        if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
          try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
        }
      } else {
        if (playPromiseRef.current !== undefined) {
          (playPromiseRef.current as Promise<void>).then(() => {
            audioRef.current?.pause();
          }).catch(() => {
            audioRef.current?.pause();
          });
        } else {
          audioRef.current?.pause();
        }
      }
    } else {
      userInitiatedPauseRef.current = false;
      setIsPlaying(true);
      ensureAudioSessionActive();
      if (activeEngine === 'youtube') {
        if (ytPlayerRef.current && ytPlayerRef.current.playVideo) {
          try { ytPlayerRef.current.playVideo(); } catch (e) {}
        }
      } else {
        safePlay();
      }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      try {
        ytPlayerRef.current.setVolume(volume * 100);
      } catch (e) {}
    }
  }, [volume]);

  const toggleShuffle = () => setIsShuffle(!isShuffle);

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const nextSong = () => {
    if (!currentSongRef.current || queue.length === 0) return;

    if (repeatModeRef.current === 'one') {
      if (activeEngine === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(0, true);
        ytPlayerRef.current.playVideo();
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.error(e));
      }
      return;
    }

    const idx = queue.findIndex(s => s.id === currentSongRef.current?.id);

    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      _playDirectly(queue[nextIdx]);
      return;
    }

    if (idx !== -1 && idx < queue.length - 1) {
      _playDirectly(queue[idx + 1]);
    } else {
      // 24/7 continuous uninterrupted queue loop
      _playDirectly(queue[0]);
    }
  };

  const prevSong = () => {
    if (!currentSongRef.current || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSongRef.current?.id);
    if (progress > 3) {
      seek(0);
    } else if (idx > 0) {
      _playDirectly(queue[idx - 1]);
    }
  };

  const seek = (time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration || 9999));
    setProgress(clampedTime);
    if (activeEngine === 'youtube') {
      if (ytPlayerRef.current && ytPlayerRef.current.seekTo) {
        try {
          ytPlayerRef.current.seekTo(clampedTime, true);
        } catch (e) {}
      }
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = clampedTime;
      }
    }
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
  };

  useEffect(() => {
    handlersRef.current = { togglePlay, nextSong, prevSong, seek };
  });

  // MediaSession lockscreen / notification center support
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      try {
        const cover = currentSong.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'Spotify',
          artwork: [
            { src: cover, sizes: '96x96', type: 'image/jpeg' },
            { src: cover, sizes: '128x128', type: 'image/jpeg' },
            { src: cover, sizes: '192x192', type: 'image/png' },
            { src: cover, sizes: '256x256', type: 'image/jpeg' },
            { src: cover, sizes: '384x384', type: 'image/jpeg' },
            { src: cover, sizes: '512x512', type: 'image/png' }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => {
          ensureAudioSessionActive();
          handlersRef.current.togglePlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          handlersRef.current.togglePlay();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => handlersRef.current.prevSong());
        navigator.mediaSession.setActionHandler('nexttrack', () => handlersRef.current.nextSong());
        navigator.mediaSession.setActionHandler('seekto', details => {
          if (details.seekTime !== undefined) handlersRef.current.seek(details.seekTime);
        });
        navigator.mediaSession.setActionHandler('seekbackward', details => {
          const skip = details.seekOffset || 10;
          handlersRef.current.seek(Math.max(0, progress - skip));
        });
        navigator.mediaSession.setActionHandler('seekforward', details => {
          const skip = details.seekOffset || 10;
          handlersRef.current.seek(Math.min(duration, progress + skip));
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          handlersRef.current.togglePlay();
        });
      } catch (e) {
        console.warn('Media session actions not supported', e);
      }
    }
  }, [currentSong]);

  // Sync position state to iOS Lock Screen scrubber
  useEffect(() => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      if (duration > 0 && typeof progress === 'number' && !isNaN(progress)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(duration, 1),
            playbackRate: 1,
            position: Math.max(0, Math.min(progress, duration))
          });
        } catch (e) {}
      }
    }
  }, [progress, duration]);

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        queue,
        isPlaying,
        progress,
        duration,
        volume,
        isShuffle,
        repeatMode,
        playSong,
        shufflePlay,
        togglePlay,
        nextSong,
        prevSong,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        reorderQueue
      }}
    >
      {children}
      {/* Background Audio Session Keeper for iOS lockscreen / closed phone playback */}
      <audio
        ref={silentAudioRef}
        playsInline
        loop
        preload="auto"
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        style={{ display: 'none' }}
      />

      {/* YouTube IFrame Player Container for full track audio playback */}
      <div
        id="yt-audio-player-container"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: 4,
          height: 4,
          opacity: 0.05,
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'hidden'
        }}
      >
        <div id="yt-audio-player" style={{ width: 4, height: 4 }}></div>
      </div>

      {/* HTML5 Audio Element for native background 24/7 audio playback */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onTimeUpdate={e => {
          if (activeEngine === 'audio') {
            const cur = e.currentTarget.currentTime;
            const dur = e.currentTarget.duration;
            if (typeof cur === 'number' && !isNaN(cur)) {
              setProgress(cur);
            }
            if (dur > 20 && cur >= dur - 15) {
              prewarmNextTrack();
            }
          }
        }}
        onLoadedMetadata={e => {
          if (activeEngine === 'audio') {
            const dur = e.currentTarget.duration;
            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              setDuration(dur);
            }
          }
        }}
        onEnded={() => {
          if (activeEngine === 'audio') {
            nextSong();
          }
        }}
        onPlay={() => {
          if (activeEngine === 'audio') {
            setIsPlaying(true);
            userInitiatedPauseRef.current = false;
          }
        }}
        onPause={() => {
          if (activeEngine === 'audio') {
            if (userInitiatedPauseRef.current) {
              setIsPlaying(false);
            } else if (isPlayingRef.current) {
              // OS Lockscreen or background interruption: automatically maintain playback
              setTimeout(() => {
                if (isPlayingRef.current && audioRef.current?.paused && !userInitiatedPauseRef.current) {
                  audioRef.current.play().catch(() => {});
                }
              }, 150);
            }
          }
        }}
        onError={handleAudioError}
      />
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};
