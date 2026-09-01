import React, { useState } from 'react';
import { Song } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { Play, Download, ListPlus, Check } from 'lucide-react';
import { downloadSong } from '../api';
import { PlaylistModal } from './PlaylistModal';

interface TrackListProps {
  songs: Song[];
  showHeader?: boolean;
}

export const TrackList: React.FC<TrackListProps> = ({ songs, showHeader = true }) => {
  const { currentSong, isPlaying, playSong } = usePlayer();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [modalSong, setModalSong] = useState<Song | null>(null);

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
    <div className="w-full pb-8">
      {modalSong && <PlaylistModal song={modalSong} onClose={() => setModalSong(null)} />}
      
      {showHeader && (
        <div className="hidden md:grid grid-cols-[16px_minmax(120px,_4fr)_2fr_minmax(120px,_1fr)] gap-4 px-4 py-2 text-sm text-zinc-400 border-b border-zinc-800 mb-4 sticky top-0 bg-zinc-900/90 backdrop-blur-md z-10">
          <div>#</div>
          <div>Title</div>
          <div>Album</div>
          <div className="text-right">Time</div>
        </div>
      )}
      <div className="flex flex-col">
        {songs.map((song, index) => {
          const isCurrent = currentSong?.id === song.id;
          return (
            <div
              key={`${song.id}-${index}`}
              onClick={() => playSong(song, songs)}
              className={`group flex items-center p-2 px-4 rounded-md cursor-pointer transition-colors ${
                isCurrent ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
              }`}
            >
              {/* Number or Play Icon */}
              <div className="w-8 flex-shrink-0 text-zinc-400 flex items-center justify-center">
                {isCurrent && isPlaying ? (
                  <div className="w-4 h-4 flex items-end justify-center space-x-[2px] overflow-hidden">
                     <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0s]" style={{height: '60%'}}></div>
                     <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0.2s]" style={{height: '100%'}}></div>
                     <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0.4s]" style={{height: '80%'}}></div>
                  </div>
                ) : (
                  <>
                    <span className="group-hover:hidden">{index + 1}</span>
                    <Play size={16} className="hidden group-hover:block fill-current text-white" />
                  </>
                )}
              </div>

              {/* Title & Artist */}
              <div className="flex-1 flex items-center min-w-0 pr-4">
                <img src={song.coverUrl} alt={song.title} className="w-10 h-10 md:w-12 md:h-12 rounded bg-zinc-800 flex-shrink-0" onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }} />
                <div className="ml-4 truncate">
                  <p className={`text-base font-medium truncate ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                    {song.title}
                  </p>
                  <p className="text-sm text-zinc-400 truncate hover:underline">{song.artist}</p>
                </div>
              </div>

              {/* Album (Desktop only) */}
              <div className="hidden md:block flex-[0.7] min-w-0 pr-4">
                <p className="text-sm text-zinc-400 truncate hover:underline">{song.album}</p>
              </div>

              {/* Actions & Duration */}
              <div className="w-32 flex-shrink-0 flex justify-end items-center space-x-4 pr-4">
                <button 
                  onClick={(e) => handleDownload(e, song)}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white"
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
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white"
                  title="Add to Playlist"
                >
                  <ListPlus size={18} />
                </button>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-zinc-400 min-w-[40px] text-right">{formatDuration(song.duration)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
