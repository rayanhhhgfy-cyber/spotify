import React, { useState, useEffect } from 'react';
import { Song } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { Play, Download, ListPlus, Check } from 'lucide-react';
import { downloadSong } from '../api';
import { PlaylistModal } from './PlaylistModal';
import { motion } from 'motion/react';

interface TrackListProps {
  songs: Song[];
  showHeader?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export const TrackList: React.FC<TrackListProps> = ({ songs, showHeader = true }) => {
  const { currentSong, isPlaying, playSong } = usePlayer();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [modalSong, setModalSong] = useState<Song | null>(null);

  useEffect(() => {
    const syncDownloads = () => {
      try {
        const downloaded = JSON.parse(localStorage.getItem('downloaded_songs') || '[]');
        setDownloadedIds(new Set(downloaded.map((s: Song) => s.id)));
      } catch {
        setDownloadedIds(new Set());
      }
    };
    syncDownloads();
    window.addEventListener('downloads-updated', syncDownloads);
    window.addEventListener('storage', syncDownloads);
    return () => {
      window.removeEventListener('downloads-updated', syncDownloads);
      window.removeEventListener('storage', syncDownloads);
    };
  }, []);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    setDownloadingId(song.id);
    const success = await downloadSong(song);
    if (success) {
      setDownloadedIds(prev => new Set(prev).add(song.id));
    }
    setDownloadingId(null);
  };

  const handleOpenModal = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    setModalSong(song);
  };

  if (songs.length === 0) {
    return <div className="text-zinc-400 py-8 text-center">No songs found.</div>;
  }

  return (
    <div className="w-full pb-8 md:pb-6">
      {modalSong && <PlaylistModal song={modalSong} onClose={() => setModalSong(null)} />}
      
      {showHeader && (
        <div className="hidden md:grid grid-cols-[16px_minmax(120px,_4fr)_2fr_minmax(120px,_1fr)] gap-4 px-4 py-2 text-sm text-zinc-400 border-b border-zinc-800 mb-4 sticky top-0 bg-zinc-900/90 backdrop-blur-md z-10">
          <div>#</div>
          <div>Title</div>
          <div>Album</div>
          <div className="text-right">Time</div>
        </div>
      )}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col space-y-0.5"
      >
        {songs.map((song, index) => {
          const isCurrent = currentSong?.id === song.id;
          return (
            <motion.div
              key={`${song.id}-${index}`}
              variants={itemVariants}
              whileTap={{ scale: 0.99 }}
              onClick={() => playSong(song, songs)}
              className={`group flex items-center py-2 px-2 sm:px-4 rounded-lg cursor-pointer transition-colors select-none touch-manipulation active:bg-zinc-800/80 ${
                isCurrent ? 'bg-zinc-850 bg-zinc-800/90' : 'hover:bg-zinc-800/50'
              }`}
            >
              {/* Number or Play Icon (hidden on smallest screens to give max space to title/artist) */}
              <div className="hidden xs:flex sm:flex w-6 sm:w-8 flex-shrink-0 text-zinc-400 items-center justify-center">
                {isCurrent && isPlaying ? (
                  <div className="w-4 h-4 flex items-end justify-center space-x-[2px] overflow-hidden">
                     <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0s]" style={{height: '60%'}}></div>
                     <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0.2s]" style={{height: '100%'}}></div>
                     <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0.4s]" style={{height: '80%'}}></div>
                  </div>
                ) : (
                  <>
                    <span className="group-hover:hidden text-xs sm:text-sm">{index + 1}</span>
                    <Play size={15} className="hidden group-hover:block fill-current text-white" />
                  </>
                )}
              </div>

              {/* Title & Artist */}
              <div className="flex-1 flex items-center min-w-0 pr-2 sm:pr-4">
                <img 
                  src={song.coverUrl} 
                  alt={song.title} 
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-md bg-zinc-800 flex-shrink-0 object-cover shadow-sm" 
                  onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }} 
                />
                <div className="ml-3 truncate min-w-0">
                  <p className={`text-sm sm:text-base font-semibold truncate ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                    {song.title}
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-400 truncate mt-0.5">{song.artist}</p>
                </div>
              </div>

              {/* Album (Desktop only) */}
              <div className="hidden md:block flex-[0.7] min-w-0 pr-4">
                <p className="text-sm text-zinc-400 truncate hover:underline">{song.album}</p>
              </div>

              {/* Actions & Duration */}
              <div className="flex-shrink-0 flex justify-end items-center space-x-1 sm:space-x-2">
                <button
                  onClick={(e) => handleDownload(e, song)}
                  className="opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-90 touch-manipulation"
                  title="Download for Offline"
                >
                  {downloadingId === song.id ? (
                    <div className="animate-spin h-4 w-4 border-2 border-zinc-400 border-t-white rounded-full"></div>
                  ) : downloadedIds.has(song.id) ? (
                    <Check size={18} className="text-green-500" />
                  ) : (
                    <Download size={18} />
                  )}
                </button>
                <button
                  onClick={(e) => handleOpenModal(e, song)}
                  className="opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-90 touch-manipulation"
                  title="Add to Playlist"
                >
                  <ListPlus size={18} />
                </button>
                <div className="hidden sm:flex flex-col items-end pr-2">
                  <span className="text-xs sm:text-sm text-zinc-400 min-w-[36px] text-right">{formatDuration(song.duration)}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};
