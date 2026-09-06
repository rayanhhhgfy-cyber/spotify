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
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [activeEngine, setActiveEngine] = useState<'youtube' | 'audio'>('audio');

  const audioRef = useRef<HTMLAudioElement>(null);
  const silentAudioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const playPromiseRef = useRef<Promise<void> | void>();
  const currentSongRef = useRef<Song | null>(null);
  const currentMirrorIndexRef = useRef<number>(0);
  const repeatModeRef = useRef<'off' | 'all' | 'one'>('off');
  const isPlayingRef = useRef<boolean>(false);
  const wasPlayingBeforeLockRef = useRef<boolean>(false);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // Ensure iOS background audio session remains active
  const ensureAudioSessionActive = () => {
    if (silentAudioRef.current) {
      if (silentAudioRef.current.paused) {
        silentAudioRef.current.play().catch(() => {});
      }
    }
  };

  const pauseAudioSession = () => {
    if (silentAudioRef.current && !silentAudioRef.current.paused) {
      silentAudioRef.current.pause();
    }
  };

  // Sync isPlaying state to ref and audio session
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

  // Keep track of latest functions for MediaSession, events, and shortcuts
  const handlersRef = useRef({
    togglePlay: () => {},
    nextSong: () => {},
    prevSong: () => {},
    seek: (_t: number) => {}
  });

  // Handle visibility changes (phone locked / closed / tab backgrounded on iPhone)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Phone locked or screen closed
        if (isPlayingRef.current) {
          wasPlayingBeforeLockRef.current = true;
          ensureAudioSessionActive();
          // Attempt to keep YouTube video playing if iOS permits
          if (activeEngine === 'youtube' && ytPlayerRef.current) {
            setTimeout(() => {
              try {
                if (isPlayingRef.current && ytPlayerRef.current?.getPlayerState?.() === 2) {
                  ytPlayerRef.current?.playVideo();
                }
              } catch (e) {}
            }, 250);
          }
        }
      } else if (document.visibilityState === 'visible') {
        // Phone unlocked or returned to app
        if (wasPlayingBeforeLockRef.current && isPlayingRef.current) {
          if (activeEngine === 'youtube' && ytPlayerRef.current) {
            try {
              const state = ytPlayerRef.current.getPlayerState?.();
              if (state === 2 || state === -1) {
                ytPlayerRef.current.playVideo();
              }
            } catch (e) {}
          } else if (activeEngine === 'audio' && audioRef.current) {
            if (audioRef.current.paused) {
              audioRef.current.play().catch(() => {});
            }
          }
          wasPlayingBeforeLockRef.current = false;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeEngine]);

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
                    wasPlayingBeforeLockRef.current = false;
                  } else if (event.data === 2) {
                    // If iOS locked the screen while we were playing, don't kill playback state
                    if (document.visibilityState === 'hidden' && isPlayingRef.current) {
                      wasPlayingBeforeLockRef.current = true;
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

    const isOffline = !navigator.onLine;

    // Check if song has a direct non-preview audio stream
    const hasDirectStream = targetSong.audioUrl &&
      !targetSong.audioUrl.startsWith('/api/stream/youtube') &&
      !targetSong.audioUrl.includes('apple.com') &&
      !targetSong.audioUrl.includes('mzstatic') &&
      (targetSong.duration > 40000 || targetSong.isFullLength);

    if ((hasDirectStream || isOffline || !targetSong.youtubeId) && targetSong.audioUrl) {
      // Use Standard Audio Engine (direct stream or offline)
      setActiveEngine('audio');
      if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {}
      }
      setIsPlaying(true);
      if (audioRef.current) {
        const candidates = targetSong.streamMirrors && targetSong.streamMirrors.length > 0 ? targetSong.streamMirrors : [targetSong.audioUrl];
        const validStream = candidates.find(c => c && !c.startsWith('/api/stream/youtube')) || candidates[0];
        audioRef.current.src = validStream || '';
        audioRef.current.load();
        safePlay();
      }
    } else if (targetSong.youtubeId && !isOffline) {
      // Use YouTube Engine
      setActiveEngine('youtube');
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(true);

      const playYT = () => {
        if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
          try {
            ytPlayerRef.current.loadVideoById(targetSong.youtubeId);
            ytPlayerRef.current.playVideo();
            if (ytPlayerRef.current.setVolume) {
              ytPlayerRef.current.setVolume(volume * 100);
            }
          } catch (e) {
            console.warn('Error loading YT video:', e);
            handleYouTubePlaybackError();
          }
        } else {
          setTimeout(playYT, 300);
        }
      };

      if (ytReadyRef.current && ytPlayerRef.current) {
        playYT();
      } else {
        setTimeout(playYT, 400);
      }
    } else {
      // Fallback audio
      setActiveEngine('audio');
      setIsPlaying(true);
      if (audioRef.current && targetSong.audioUrl) {
        audioRef.current.src = targetSong.audioUrl;
        audioRef.current.load();
        safePlay();
      }
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
      setIsPlaying(false);
      pauseAudioSession();
      if (activeEngine === 'youtube') {
        if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch (e) {}
        }
      } else {
        if (playPromiseRef.current !== undefined) {
          playPromiseRef.current.then(() => {
            audioRef.current?.pause();
          }).catch(() => {
            audioRef.current?.pause();
          });
        } else {
          audioRef.current?.pause();
        }
      }
    } else {
      setIsPlaying(true);
      ensureAudioSessionActive();
      if (activeEngine === 'youtube') {
        if (ytPlayerRef.current && ytPlayerRef.current.playVideo) {
          try {
            ytPlayerRef.current.playVideo();
          } catch (e) {}
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
    } else if (repeatModeRef.current === 'all') {
      _playDirectly(queue[0]);
    } else {
      setIsPlaying(false);
      setProgress(0);
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
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'Spotify Clone',
          artwork: [
            {
              src: currentSong.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
              sizes: '300x300',
              type: 'image/jpeg'
            },
            {
              src: (currentSong.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg').replace('300x300', '600x600'),
              sizes: '600x600',
              type: 'image/jpeg'
            }
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

      {/* HTML5 Audio Element for direct stream fallback and local audio */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onTimeUpdate={e => {
          if (activeEngine === 'audio') {
            setProgress(e.currentTarget.currentTime);
          }
        }}
        onLoadedMetadata={e => {
          if (activeEngine === 'audio') {
            setDuration(e.currentTarget.duration);
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
          }
        }}
        onPause={() => {
          if (activeEngine === 'audio') {
            if (document.visibilityState !== 'hidden' || !wasPlayingBeforeLockRef.current) {
              setIsPlaying(false);
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
