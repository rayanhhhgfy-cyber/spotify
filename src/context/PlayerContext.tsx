import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
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
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  playSong: (song: Song, newQueue?: Song[], autoExpand?: boolean) => void;
  shufflePlay: (songs: Song[]) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  removeFromQueue: (songId: string) => void;
  clearQueue: () => void;
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeEngine, setActiveEngine] = useState<'youtube' | 'audio'>('audio');

  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const playPromiseRef = useRef<Promise<void> | void>();
  const currentSongRef = useRef<Song | null>(null);
  const currentMirrorIndexRef = useRef<number>(0);
  const playStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatModeRef = useRef<'off' | 'all' | 'one'>('all');
  const isPlayingRef = useRef<boolean>(false);
  const userInitiatedPauseRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const prewarmedTrackIdRef = useRef<string | null>(null);
  const activeEngineRef = useRef<'youtube' | 'audio'>('audio');
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    activeEngineRef.current = activeEngine;
  }, [activeEngine]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // Keep iOS / Android / Desktop audio session actively authorized in background
  const applyAudioSessionPlayback = () => {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        (navigator as any).audioSession.type = 'playback';
      } catch (e) {}
    }
  };

  useEffect(() => {
    applyAudioSessionPlayback();
  }, []);

  const ensureAudioSessionActive = () => {
    applyAudioSessionPlayback();
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

    // If using native audio engine, resume playback if it was paused unexpectedly
    if (activeEngineRef.current === 'audio' && audioRef.current) {
      if (audioRef.current.paused && isPlayingRef.current && !userInitiatedPauseRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }

    // CRITICAL FIX: If using YouTube engine, play a silent loop on the native audio element to keep iOS background media session alive
    if (activeEngineRef.current === 'youtube' && audioRef.current) {
      if (!audioRef.current.src || !audioRef.current.src.includes('data:audio/mpeg')) {
        audioRef.current.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIwBRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFR//NVAAAAA0AAAAgAAAADhABAAABAAACdSAwAAAAAAAAAAAAAAH//NRAAAAAwAAAAgAAH////0QAAAAEAAAAcAAAAAwAAAAMAAAD//NUAAAAAwAAAAgAAH////0QAAAAEAAAAcAAAAAwAAAAMAAAD//NUAAAAAwAAAAgAAH////0QAAAAEAAAAcAAAAAwAAAAMAAAD//NUAAAAAwAAAAgAAH////0QAAAAEAAAAcAAAAAwAAAAMAAAD';
        audioRef.current.loop = true;
      }
      if (audioRef.current.paused && isPlayingRef.current && !userInitiatedPauseRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const pauseAudioSession = () => {
    // Audio element pause is handled directly
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

  // Background resilience heartbeat: iOS/Android can silently reject a single resume
  // attempt (e.g. right when the screen locks) with no further retry, leaving isPlaying
  // stuck "true" while the audio element is actually paused forever. This periodically
  // re-asserts the session and retries play() every few seconds while backgrounded, so a
  // later attempt (e.g. aligned with a buffer refill or lock-screen control event) can
  // succeed even if the first one was rejected. Does not touch foreground behavior.
  useEffect(() => {
    if (!isPlaying) return;
    const heartbeat = setInterval(() => {
      if (document.visibilityState !== 'hidden') return;
      if (!isPlayingRef.current || userInitiatedPauseRef.current) return;

      applyAudioSessionPlayback();
      try {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      } catch (e) {}
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
      }

      if (activeEngineRef.current === 'youtube' && ytPlayerRef.current) {
        try {
          if (typeof ytPlayerRef.current.getPlayerState === 'function' && ytPlayerRef.current.getPlayerState() !== 1) {
            ytPlayerRef.current.playVideo();
          }
        } catch (e) {}
        ensureAudioSessionActive();
      } else if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }, 3000);
    return () => clearInterval(heartbeat);
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
      applyAudioSessionPlayback();
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
        if (isPlayingRef.current) {
          if (activeEngineRef.current === 'youtube' && ytPlayerRef.current) {
            try { ytPlayerRef.current.playVideo(); } catch (e) {}
          }
          if (audioRef.current && audioRef.current.paused && !userInitiatedPauseRef.current) {
            audioRef.current.play().catch(() => {});
          }
          if (audioRef.current && typeof audioRef.current.currentTime === 'number' && !isNaN(audioRef.current.currentTime)) {
            setProgress(audioRef.current.currentTime);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', applyAudioSessionPlayback);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', applyAudioSessionPlayback);
    };
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

  const removeFromQueue = (songId: string) => {
    setQueue(prev => prev.filter(s => s.id !== songId));
  };

  const clearQueue = () => {
    if (currentSongRef.current) {
      setQueue([currentSongRef.current]);
    } else {
      setQueue([]);
    }
  };

  const handleAudioError = () => {
    if (playStartTimeoutRef.current) {
      clearTimeout(playStartTimeoutRef.current);
      playStartTimeoutRef.current = null;
    }
    if (!currentSongRef.current) return;
    const song = currentSongRef.current;
    const candidates = song.streamMirrors && song.streamMirrors.length > 0 ? song.streamMirrors : (song.audioUrl ? [song.audioUrl] : []);

    if (currentMirrorIndexRef.current + 1 < candidates.length) {
      currentMirrorIndexRef.current += 1;
      const nextUrl = candidates[currentMirrorIndexRef.current];
      if (nextUrl) {
        loadAndPlayStream(nextUrl);
        return;
      }
    }

    if (song.youtubeId) {
      setActiveEngine('youtube');
      activeEngineRef.current = 'youtube';
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(song.youtubeId);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          isPlayingRef.current = true;
          return;
        } catch (e) {}
      }
    }

    handlersRef.current.nextSong();
  };

  const handleYouTubePlaybackError = (_errorCode?: any) => {
    if (currentSongRef.current?.backupYoutubeIds && currentSongRef.current.backupYoutubeIds.length > 0) {
      const nextId = currentSongRef.current.backupYoutubeIds.shift();
      if (nextId && ytPlayerRef.current) {
        currentSongRef.current.youtubeId = nextId;
        try {
          ytPlayerRef.current.loadVideoById(nextId);
          ytPlayerRef.current.playVideo();
          return;
        } catch (e) {}
      }
    }
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

  const loadAndPlayStream = (url: string) => {
    if (!audioRef.current || !url) return;

    setActiveEngine('audio');
    activeEngineRef.current = 'audio';
    if (ytPlayerRef.current?.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
    }

    // Startup watchdog: if the stream endpoint hangs or stalls (slow yt-dlp extraction, dead
    // upstream, etc.) instead of failing fast with a clean error event, the <audio> element can
    // sit stuck at currentTime 0 indefinitely with no error ever firing, making the song appear
    // to "not start" with no fallback ever triggering. Force a fallback attempt if playback
    // hasn't actually produced audio within 7s.
    if (playStartTimeoutRef.current) clearTimeout(playStartTimeoutRef.current);
    const watchedSongId = currentSongRef.current?.id;
    playStartTimeoutRef.current = setTimeout(() => {
      if (
        activeEngineRef.current === 'audio' &&
        currentSongRef.current?.id === watchedSongId &&
        audioRef.current &&
        audioRef.current.currentTime === 0 &&
        isPlayingRef.current
      ) {
        handleAudioError();
      }
    }, 7000);

    if (url.includes('.m3u8')) {
      if (audioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support on iOS Safari / macOS Safari
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        audioRef.current.src = url;
        safePlay();
      } else if (Hls.isSupported()) {
        // Hls.js on Android Chrome / Desktop Chrome / Firefox
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(audioRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          safePlay();
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.warn('HLS fatal error:', data.type);
            handleAudioError();
          }
        });
      } else {
        audioRef.current.src = url;
        safePlay();
      }
    } else {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audioRef.current.src = url;
      safePlay();
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

    // 1. If song already has a youtubeId, play that EXACT track directly! Never override or hijack!
    // IMPORTANT: use the native audio proxy (/api/stream/youtube/:id) via the audio/HLS engine, not
    // the hidden YouTube iframe player. Iframe-embedded video playback is suspended by iOS/Android the
    // moment the app is backgrounded or the screen locks, and no amount of JS retry can resume it without
    // a fresh user gesture — so using it as the primary engine breaks background/lock-screen playback for
    // virtually every track. The native <audio> element (below) is handled by the OS media pipeline
    // directly and keeps playing in the background reliably. The iframe player remains available as a
    // last-resort fallback in handleAudioError() if the proxy stream genuinely fails.
    if (targetSong.youtubeId) {
      loadAndPlayStream(`/api/stream/youtube/${targetSong.youtubeId}`);
      ensureAudioSessionActive();
      return;
    }

    // 2. If song has a valid non-preview audio URL (Audius full track, direct mp3), play via audio engine
    const isPreview = !targetSong.audioUrl || targetSong.audioUrl.includes('apple.com') || (targetSong.duration && targetSong.duration <= 30000);
    if (!isPreview && targetSong.audioUrl && !targetSong.audioUrl.startsWith('/api/stream/youtube')) {
      const candidates = targetSong.streamMirrors && targetSong.streamMirrors.length > 0 ? targetSong.streamMirrors : [targetSong.audioUrl];
      const validStream = candidates[0] || targetSong.audioUrl;
      const currentSrc = audioRef.current?.src || '';
      const isAlreadyPlayingThis = currentSrc === validStream || currentSrc.endsWith(validStream);

      if (!isAlreadyPlayingThis) {
        loadAndPlayStream(validStream);
      } else if (audioRef.current?.paused && !userInitiatedPauseRef.current) {
        safePlay();
      }
      return;
    }

    // 3. Fallback: track needs resolution (e.g. from 30s preview or missing ID)
    const resolved = await resolveFullLengthStream(targetSong.title, targetSong.artist, false, targetSong.duration);
    if (resolved && currentSongRef.current?.id === song.id) {
      if (resolved.youtubeId) {
        targetSong.youtubeId = resolved.youtubeId;
        targetSong.backupYoutubeIds = resolved.backupYoutubeIds || [];
        if (resolved.duration) {
          targetSong.duration = resolved.duration;
          setDuration(resolved.duration / 1000);
        }
        targetSong.isFullLength = true;
        setCurrentSong(targetSong);
        currentSongRef.current = targetSong;
        setActiveEngine('youtube');
        activeEngineRef.current = 'youtube';
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.loadVideoById(resolved.youtubeId);
            ytPlayerRef.current.playVideo();
            setIsPlaying(true);
            isPlayingRef.current = true;
          } catch (e) {}
        }
        ensureAudioSessionActive();
        return;
      } else if (resolved.audioUrl && !resolved.audioUrl.startsWith('/api/stream/youtube')) {
        targetSong.audioUrl = resolved.audioUrl;
        targetSong.streamMirrors = resolved.mirrors && resolved.mirrors.length > 0 ? resolved.mirrors : [resolved.audioUrl];
        if (resolved.duration) {
          targetSong.duration = resolved.duration;
          setDuration(resolved.duration / 1000);
        }
        targetSong.isFullLength = true;
        setCurrentSong(targetSong);
        currentSongRef.current = targetSong;
        loadAndPlayStream(targetSong.audioUrl);
        return;
      }
    }
  };

  const playSong = (song: Song, newQueue: Song[] = [], autoExpand: boolean = false) => {
    applyAudioSessionPlayback();
    ensureAudioSessionActive();
    userInitiatedPauseRef.current = false;
    setIsPlaying(true);
    isPlayingRef.current = true;

    if (newQueue.length > 0) {
      setQueue(newQueue);
    } else if (queue.length === 0) {
      setQueue([song]);
    }
    startPlayback(song);
    if (autoExpand) {
      setIsExpanded(true);
    }
  };

  const shufflePlay = (songs: Song[]) => {
    if (!songs || songs.length === 0) return;
    applyAudioSessionPlayback();
    ensureAudioSessionActive();
    userInitiatedPauseRef.current = false;
    setIsPlaying(true);
    isPlayingRef.current = true;

    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setIsShuffle(true);
    setQueue(shuffled);

    startPlayback(shuffled[0]);
    setIsExpanded(true);
  };

  const _playDirectly = (song: Song) => {
    applyAudioSessionPlayback();
    ensureAudioSessionActive();
    userInitiatedPauseRef.current = false;
    setIsPlaying(true);
    isPlayingRef.current = true;

    startPlayback(song);
  };

  const togglePlay = () => {
    if (!currentSong) return;

    if (isPlaying) {
      userInitiatedPauseRef.current = true;
      setIsPlaying(false);
      isPlayingRef.current = false;
      pauseAudioSession();

      if (activeEngine === 'youtube' && ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
        if (audioRef.current) {
          audioRef.current.pause();
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
      isPlayingRef.current = true;
      applyAudioSessionPlayback();
      ensureAudioSessionActive();

      if (activeEngine === 'youtube' && ytPlayerRef.current) {
        try { ytPlayerRef.current.playVideo(); } catch (e) {}
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
      const nextS = queue[nextIdx];
      _playDirectly(nextS);
      return;
    }

    if (idx !== -1 && idx < queue.length - 1) {
      const nextS = queue[idx + 1];
      _playDirectly(nextS);
    } else {
      // 24/7 continuous uninterrupted queue loop
      const nextS = queue[0];
      _playDirectly(nextS);
    }
  };

  const prevSong = () => {
    if (!currentSongRef.current || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSongRef.current?.id);
    if (progress > 3) {
      seek(0);
    } else if (idx > 0) {
      const prevS = queue[idx - 1];
      _playDirectly(prevS);
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
          applyAudioSessionPlayback();
          ensureAudioSessionActive();
          userInitiatedPauseRef.current = false;
          setIsPlaying(true);
          isPlayingRef.current = true;
          if (activeEngineRef.current === 'youtube' && ytPlayerRef.current) {
            try { ytPlayerRef.current.playVideo(); } catch (e) {}
          }
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          userInitiatedPauseRef.current = true;
          setIsPlaying(false);
          isPlayingRef.current = false;
          if (activeEngineRef.current === 'youtube' && ytPlayerRef.current) {
            try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
          }
          if (audioRef.current) {
            audioRef.current.pause();
          }
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
        reorderQueue,
        removeFromQueue,
        clearQueue,
        isExpanded,
        setIsExpanded
      }}
    >
      {children}

      {/* YouTube IFrame Player Container for full track audio playback */}
      <div
        id="yt-audio-player-container"
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          zIndex: -1,
          pointerEvents: 'none',
          overflow: 'hidden'
        }}
      >
        <div id="yt-audio-player" style={{ width: 1, height: 1 }}></div>
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
            if (cur > 0 && playStartTimeoutRef.current) {
              clearTimeout(playStartTimeoutRef.current);
              playStartTimeoutRef.current = null;
            }
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
          if (userInitiatedPauseRef.current) {
            setIsPlaying(false);
          } else if (isPlayingRef.current) {
            // Immediate synchronous attempt if not user initiated (e.g. system interruption / phone locked)
            applyAudioSessionPlayback();
            ensureAudioSessionActive();
            try {
              audioRef.current?.play().catch(() => {});
            } catch (e) {}
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
