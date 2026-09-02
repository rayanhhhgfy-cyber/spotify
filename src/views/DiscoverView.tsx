import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getDiscoverReelSongs } from '../api';
import { Song } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { Heart, Share2, Disc, Play, Pause, ChevronUp, ChevronDown, Sparkles, Music2, Volume2, VolumeX } from 'lucide-react';
import { isSongSaved, toggleSaveSong } from '../api';
import { motion, AnimatePresence } from 'motion/react';

export const DiscoverView: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentSong, isPlaying, playSong, togglePlay, setVolume, volume } = usePlayer();

  // Load 1,000+ songs into the Discover reel pool
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getDiscoverReelSongs(1000).then((res) => {
      if (!isMounted) return;
      // Shuffle initially for an unpredictable, exciting discovery feed
      const shuffled = [...res].sort(() => Math.random() - 0.5);
      setSongs(shuffled);
      setLoading(false);

      // Instantly start playing the first song like Instagram Reels
      if (shuffled.length > 0) {
        playSong(shuffled[0], shuffled);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync active reel item when scrolling (Instagram Reels snap physics)
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const itemHeight = container.clientHeight;
    if (itemHeight <= 0) return;

    const newIndex = Math.round(container.scrollTop / itemHeight);
    if (newIndex >= 0 && newIndex < songs.length && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, songs.length]);

  // When activeIndex changes (e.g. user scrolled to the next/prev reel),
  // automatically play the current reel song if it's not already playing
  useEffect(() => {
    if (songs.length === 0 || activeIndex < 0 || activeIndex >= songs.length) return;
    const targetSong = songs[activeIndex];
    
    // Autoplay when you land on the reel (just like Instagram Reels / TikTok)
    if (!currentSong || currentSong.id !== targetSong.id) {
      playSong(targetSong, songs);
    }
  }, [activeIndex, songs]);

  // Keyboard navigation (Arrow Up / Arrow Down / Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, songs.length, togglePlay]);

  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;
    const clampedIndex = Math.max(0, Math.min(index, songs.length - 1));
    const targetY = clampedIndex * containerRef.current.clientHeight;
    containerRef.current.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });
    setActiveIndex(clampedIndex);
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(volume > 0 ? volume : 0.8);
      setIsMuted(false);
    } else {
      setVolume(0);
      setIsMuted(true);
    }
  };

  if (loading && songs.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-90px)] bg-black text-white gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-zinc-800 border-t-green-500 animate-spin"></div>
          <Disc size={28} className="absolute inset-0 m-auto text-green-500 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">Loading Discover Reels...</p>
          <p className="text-xs text-zinc-500">Preparing 1,000+ tracks curated for you</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-90px)] md:h-[calc(100vh-90px)] w-full bg-black overflow-hidden select-none">
      {/* Top Floating Badge */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-auto">
        <Sparkles size={14} className="text-green-400 animate-pulse" />
        <span className="text-xs font-bold text-white tracking-wide">
          Discover Feed ({activeIndex + 1} / {songs.length})
        </span>
      </div>

      {/* Floating Mute & Up/Down Navigation Controls */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={toggleMute}
          className="p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white/90 hover:text-white border border-white/10 transition-transform active:scale-95 shadow-lg"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={18} className="text-red-400" /> : <Volume2 size={18} />}
        </button>

        <div className="hidden md:flex flex-col gap-1 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/10">
          <button
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors"
            title="Previous track"
          >
            <ChevronUp size={18} />
          </button>
          <button
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex >= songs.length - 1}
            className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors"
            title="Next track"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      {/* Share Toast */}
      <AnimatePresence>
        {copiedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-black text-xs font-bold px-4 py-2 rounded-full shadow-2xl"
          >
            Song link copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Snap Scrolling Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory bg-black relative hide-scrollbar scroll-smooth"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {songs.map((song, index) => {
          // Render full content for active item and adjacent 3 items to optimize memory & performance for 1000 items
          const isNearby = Math.abs(index - activeIndex) <= 3;
          return (
            <DiscoverReelItem
              key={song.id}
              song={song}
              isActive={index === activeIndex}
              isPlaying={isPlaying && currentSong?.id === song.id}
              isNearby={isNearby}
              onTogglePlay={togglePlay}
              onShare={() => {
                const url = `${window.location.origin}/?q=${encodeURIComponent(song.title + ' ' + song.artist)}`;
                navigator.clipboard?.writeText(url).then(() => {
                  setCopiedNotification(true);
                  setTimeout(() => setCopiedNotification(false), 2500);
                });
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

interface ReelItemProps {
  song: Song;
  isActive: boolean;
  isPlaying: boolean;
  isNearby: boolean;
  onTogglePlay: () => void;
  onShare: () => void;
}

const DiscoverReelItem: React.FC<ReelItemProps> = React.memo(({
  song,
  isActive,
  isPlaying,
  isNearby,
  onTogglePlay,
  onShare
}) => {
  const [saved, setSaved] = useState(false);
  const [likeHeartPop, setLikeHeartPop] = useState(false);

  useEffect(() => {
    if (isNearby) {
      setSaved(isSongSaved(song.id));
    }
  }, [song.id, isNearby]);

  const handleLike = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    toggleSaveSong(song).then((newSaved) => {
      setSaved(newSaved);
      if (newSaved) {
        setLikeHeartPop(true);
        setTimeout(() => setLikeHeartPop(false), 800);
      }
    });
  };

  // Double tap to like feature (just like Instagram Reels)
  const lastTapRef = useRef<number>(0);
  const handleCardClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      // Double tap detected
      handleLike();
    } else {
      // Single tap: toggle play / pause
      onTogglePlay();
    }
    lastTapRef.current = now;
  };

  if (!isNearby) {
    return <div className="h-full w-full snap-start snap-always bg-black" />;
  }

  return (
    <div
      onClick={handleCardClick}
      className="h-full w-full snap-start snap-always relative flex items-center justify-center overflow-hidden bg-black cursor-pointer select-none"
    >
      {/* Cinematic Blurred Ambient Backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35 blur-3xl scale-125 transition-all duration-700 pointer-events-none"
        style={{ backgroundImage: `url(${song.coverUrl})` }}
      />
      {/* Dark Vignette Overlay for Crisp Legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/90 pointer-events-none" />

      {/* Big Like Heart Animation on double tap */}
      <AnimatePresence>
        {likeHeartPop && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.4, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute z-50 pointer-events-none text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]"
          >
            <Heart size={100} className="fill-current" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Center Vinyl & Artwork Presentation */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        {/* Cover Art with Vinyl Record Slide-Out Effect */}
        <div className="relative mb-6">
          {/* Rotating Vinyl Record behind album cover */}
          <div
            className={`absolute top-0 right-0 w-52 h-52 md:w-64 md:h-64 rounded-full bg-zinc-950 border-4 border-zinc-900 shadow-2xl flex items-center justify-center transition-all duration-700 ${
              isActive && isPlaying ? 'translate-x-12 rotate-[360deg]' : 'translate-x-0'
            }`}
            style={{
              transition: 'transform 8s linear infinite, translate 0.5s ease-out',
              animation: isActive && isPlaying ? 'spin 6s linear infinite' : 'none'
            }}
          >
            {/* Vinyl grooves */}
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border border-zinc-800/80 flex items-center justify-center">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border border-zinc-700/60 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 relative">
                  <img src={song.coverUrl} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 m-auto w-3 h-3 bg-black rounded-full border border-zinc-600"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Album Artwork Card */}
          <div className="relative z-20">
            <img
              src={song.coverUrl}
              alt={song.title}
              className={`w-56 h-56 md:w-64 md:h-64 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] object-cover ring-1 ring-white/10 transition-transform duration-500 ${
                isActive ? 'scale-100' : 'scale-90 opacity-60'
              }`}
              onError={(e) => {
                e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg';
              }}
            />

            {/* Tap to Play / Pause center feedback button */}
            <div
              className={`absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-opacity duration-300 ${
                isPlaying && isActive ? 'opacity-0 hover:opacity-100' : 'opacity-90'
              }`}
            >
              {isPlaying && isActive ? <Pause size={24} className="fill-white" /> : <Play size={24} className="fill-white ml-0.5" />}
            </div>
          </div>
        </div>

        {/* Track Title & Artist Info */}
        <div className="text-center w-full z-20">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            {isActive && isPlaying && (
              <span className="flex items-end gap-0.5 h-3.5 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                <span className="w-0.5 h-2.5 bg-green-400 animate-pulse"></span>
                <span className="w-0.5 h-3.5 bg-green-400 animate-pulse delay-75"></span>
                <span className="w-0.5 h-1.5 bg-green-400 animate-pulse delay-150"></span>
              </span>
            )}
            <p className="text-xs uppercase font-bold tracking-widest text-zinc-400">{song.album || 'Now Playing'}</p>
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white mb-1.5 tracking-tight line-clamp-1 drop-shadow-md">
            {song.title}
          </h2>
          <p className="text-lg md:text-xl text-zinc-300 font-medium mb-5 line-clamp-1 drop-shadow">
            {song.artist}
          </p>

          {/* Quick Play / Pause Pill Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            className={`w-full py-3.5 px-6 rounded-full font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-98 ${
              isActive && isPlaying
                ? 'bg-green-500 text-black hover:bg-green-400'
                : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {isActive && isPlaying ? (
              <>
                <Pause size={18} className="fill-black" />
                <span>Pause Song</span>
              </>
            ) : (
              <>
                <Play size={18} className="fill-black ml-0.5" />
                <span>Play Song</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floating Instagram Reels Style Right-Side Action Sidebar */}
      <div className="absolute right-4 md:right-8 bottom-28 md:bottom-24 flex flex-col gap-5 items-center z-30 pointer-events-auto">
        {/* Like Button */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          title={saved ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        >
          <div className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 group-hover:bg-black/90 group-hover:border-white/30 transition-all shadow-xl">
            <Heart
              size={22}
              className={saved ? 'fill-red-500 text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 'text-white'}
            />
          </div>
          <span className="text-[11px] font-semibold text-zinc-300 group-hover:text-white">
            {saved ? 'Liked' : 'Like'}
          </span>
        </button>

        {/* Share Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          title="Share song"
        >
          <div className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 group-hover:bg-black/90 group-hover:border-white/30 transition-all shadow-xl">
            <Share2 size={20} className="text-white" />
          </div>
          <span className="text-[11px] font-semibold text-zinc-300 group-hover:text-white">Share</span>
        </button>

        {/* Music Disc Icon */}
        <div
          className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/40 mt-1 shadow-2xl relative"
          style={{
            animation: isActive && isPlaying ? 'spin 4s linear infinite' : 'none'
          }}
        >
          <img src={song.coverUrl} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 m-auto w-2.5 h-2.5 bg-black rounded-full border border-zinc-500"></div>
        </div>
      </div>
    </div>
  );
});
