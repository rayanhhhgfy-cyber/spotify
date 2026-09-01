import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Shuffle, Repeat, Repeat1, ListMusic } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { isSongSaved, toggleSaveSong } from '../api';
import { ExpandedPlayer } from './ExpandedPlayer';
import { PlaylistModal } from './PlaylistModal';

interface PlayerBarProps {
  currentView?: string;
  onViewChange?: (view: string) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({ currentView, onViewChange }) => {
  const { currentSong, isPlaying, progress, duration, volume, isShuffle, repeatMode, togglePlay, nextSong, prevSong, seek, setVolume, toggleShuffle, toggleRepeat } = usePlayer();
  const [isSaved, setIsSaved] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  useEffect(() => {
    if (currentSong) {
      setIsSaved(isSongSaved(currentSong.id));
    }
  }, [currentSong]);

  const handleSave = async () => {
    if (currentSong) {
      const saved = await toggleSaveSong(currentSong);
      setIsSaved(saved);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 h-16 md:h-24 bg-zinc-900 md:bg-[#181818] border-t border-zinc-800 md:border-t-0 flex items-center justify-between px-4 z-[60]">
      {/* Left: Song Info */}
      <div 
        className="flex items-center w-[30%] min-w-[120px] cursor-pointer hover:bg-zinc-800/50 p-2 -ml-2 rounded-lg transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <img src={currentSong.coverUrl} alt={currentSong.title} className="h-10 w-10 md:h-14 md:w-14 rounded-md shadow-lg" onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }} />
        <div className="ml-3 md:ml-4 overflow-hidden">
          <div className="flex items-center space-x-2">
            <p className="text-white text-sm font-medium truncate">{currentSong.title}</p>
          </div>
          <p className="text-zinc-400 text-xs truncate">{currentSong.artist}</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="ml-4 hidden md:block text-zinc-400 hover:text-white transition-colors">
          <Heart size={20} className={isSaved ? "fill-green-500 text-green-500" : ""} />
        </button>
      </div>

      {/* Center: Controls */}
      <div className="flex flex-col items-center max-w-[40%] flex-1">
        <div className="flex items-center space-x-4 md:space-x-6">
          <button onClick={toggleShuffle} className={`transition-colors hidden md:block ${isShuffle ? 'text-green-500 hover:text-green-400' : 'text-zinc-400 hover:text-white'}`}>
            <Shuffle size={18} />
          </button>
          <button onClick={prevSong} className="text-zinc-400 hover:text-white transition-colors hidden md:block">
            <SkipBack size={20} className="fill-current" />
          </button>
          <button 
            onClick={togglePlay} 
            className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
          </button>
          <button onClick={nextSong} className="text-zinc-400 hover:text-white transition-colors hidden md:block">
            <SkipForward size={20} className="fill-current" />
          </button>
          <button onClick={toggleRepeat} className={`transition-colors hidden md:block ${repeatMode !== 'off' ? 'text-green-500 hover:text-green-400' : 'text-zinc-400 hover:text-white'}`}>
            {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>
        
        {/* Progress Bar (Desktop only) */}
        <div className="hidden md:flex w-full items-center space-x-2 mt-2">
          <span className="text-xs text-zinc-400 w-8 text-right">{formatTime(progress)}</span>
          <div className="flex-1 group h-3 flex items-center relative cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            seek(percent * duration);
          }}>
            <div className="w-full h-1 bg-zinc-600 rounded-full absolute">
              <div 
                className="h-full bg-white group-hover:bg-green-500 rounded-full transition-colors" 
                style={{ width: `${(progress / (duration || 1)) * 100}%` }} 
              />
            </div>
            <div 
              className="absolute h-3 w-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity" 
              style={{ left: `calc(${(progress / (duration || 1)) * 100}% - 6px)` }} 
            />
          </div>
          <span className="text-xs text-zinc-400 w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Queue */}
      <div className="hidden md:flex items-center justify-end w-[30%] space-x-4">
        {onViewChange && (
          <button 
            onClick={() => onViewChange('queue')} 
            className={`transition-colors ${currentView === 'queue' ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
          >
            <ListMusic size={18} />
          </button>
        )}
        <div className="flex items-center space-x-2">
          <Volume2 size={20} className="text-zinc-400" />
          <div className="w-24 group h-3 flex items-center relative cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            setVolume(percent);
          }}>
            <div className="w-full h-1 bg-zinc-600 rounded-full absolute">
              <div 
                className="h-full bg-white group-hover:bg-green-500 rounded-full transition-colors" 
                style={{ width: `${volume * 100}%` }} 
              />
            </div>
            <div 
              className="absolute h-3 w-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity" 
              style={{ left: `calc(${volume * 100}% - 6px)` }} 
            />
          </div>
        </div>
      </div>
      
      {/* Mobile progress bar minimal */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-800">
         <div 
           className="h-full bg-white transition-all duration-300" 
           style={{ width: `${(progress / (duration || 1)) * 100}%` }}
         />
      </div>

      {isExpanded && (
        <ExpandedPlayer 
          onClose={() => setIsExpanded(false)} 
          onOpenPlaylistModal={(e) => { e.stopPropagation(); setShowPlaylistModal(true); }} 
        />
      )}
      
      {showPlaylistModal && currentSong && (
        <PlaylistModal song={currentSong} onClose={() => setShowPlaylistModal(false)} />
      )}
    </div>
  );
};
