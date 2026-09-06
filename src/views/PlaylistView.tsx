import React, { useEffect, useState } from 'react';
import { getPlaylists, deletePlaylist, removeSongFromPlaylist, renamePlaylist, reorderPlaylistSongs, downloadPlaylist } from '../api';
import { Playlist, Song } from '../types';
import { Music, Trash2, Edit2, GripVertical, Play, Shuffle, AlertTriangle, Share2, Download, CheckCircle2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { SharePlaylistModal } from '../components/SharePlaylistModal';

interface PlaylistViewProps {
  playlistId: string;
  onViewChange?: (view: string) => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistId, onViewChange }) => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatusText, setDownloadStatusText] = useState('');
  const [isDownloaded, setIsDownloaded] = useState(false);
  const { playSong, shufflePlay, currentSong, isPlaying } = usePlayer();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    const load = () => {
      if (isEditing) return; // Do not overwrite while user is editing
      const p = getPlaylists().find(p => p.id === playlistId);
      if (p) {
        setPlaylist(p);
        setNewName(p.name);
        // Check if all songs are downloaded locally
        try {
          const downloaded = JSON.parse(localStorage.getItem('downloaded_songs') || '[]');
          const allDownloaded = p.songs.length > 0 && p.songs.every(s => downloaded.some((dl: Song) => dl.id === s.id));
          setIsDownloaded(allDownloaded);
        } catch {
          setIsDownloaded(false);
        }
      } else {
        setPlaylist(null);
      }
    };
    load();
    const handleUpdate = () => load();
    window.addEventListener('playlists-updated', handleUpdate);
    window.addEventListener('downloads-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    const interval = setInterval(load, 2000);
    return () => {
      window.removeEventListener('playlists-updated', handleUpdate);
      window.removeEventListener('downloads-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, [playlistId, isEditing]);

  if (!playlist) {
    return (
      <div className="px-6 py-20 text-center text-zinc-400">
        <p className="text-xl font-bold mb-4">Playlist not found</p>
        {onViewChange && (
          <button 
            onClick={() => onViewChange('library')} 
            className="px-6 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
          >
            Go to Library
          </button>
        )}
      </div>
    );
  }

  const handleRename = () => {
    if (newName.trim()) {
      renamePlaylist(playlist.id, newName.trim());
      setPlaylist({...playlist, name: newName.trim()});
      setIsEditing(false);
    }
  };

  const handleConfirmDeletePlaylist = () => {
    deletePlaylist(playlist.id);
    setShowDeleteModal(false);
    if (onViewChange) {
      onViewChange('library');
    }
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    
    const newSongs = [...playlist.songs];
    const [removed] = newSongs.splice(draggedIdx, 1);
    newSongs.splice(idx, 0, removed);
    
    reorderPlaylistSongs(playlist.id, newSongs);
    setPlaylist({...playlist, songs: newSongs});
    setDraggedIdx(null);
  };

  const handleDeleteSong = (songId: string) => {
    removeSongFromPlaylist(playlist.id, songId);
    setPlaylist({...playlist, songs: playlist.songs.filter(s => s.id !== songId)});
  };

  const handleDownload = async () => {
    if (!playlist || playlist.songs.length === 0) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStatusText('Starting download...');
    
    await downloadPlaylist(playlist, (progress, title) => {
      setDownloadProgress(progress);
      setDownloadStatusText(title === 'Complete' ? 'Download Complete!' : `Downloading: ${title}`);
    });
    
    setTimeout(() => {
      setIsDownloading(false);
      try {
        const downloaded = JSON.parse(localStorage.getItem('downloaded_songs') || '[]');
        const allDownloaded = playlist.songs.length > 0 && playlist.songs.every(s => downloaded.some((dl: Song) => dl.id === s.id));
        setIsDownloaded(allDownloaded);
        if (!allDownloaded) setDownloadStatusText('Some tracks failed to download');
      } catch {
        setIsDownloaded(false);
      }
    }, 1500);
  };

  return (
    <div className="px-3.5 sm:px-6 py-4 sm:py-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row items-center md:items-end space-y-4 md:space-y-0 md:space-x-6 mb-6 sm:mb-8 text-center md:text-left">
        <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-2xl bg-zinc-800 flex items-center justify-center shadow-xl overflow-hidden group flex-shrink-0">
          {playlist.songs.length > 0 ? (
            <img 
              src={(playlist.songs[0].coverUrl || '').replace('300x300', '600x600')} 
              alt="Cover" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
              onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }}
            />
          ) : (
            <Music size={54} className="text-zinc-600 shadow-sm" />
          )}
        </div>
        <div className="pb-2 flex-1 min-w-0 w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Playlist</p>
          
          {isEditing ? (
            <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
              <input 
                type="text" 
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="bg-zinc-800 text-2xl sm:text-4xl md:text-5xl font-black text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full max-w-md"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleRename()}
              />
              <button onClick={handleRename} className="bg-green-500 text-black px-4 py-2 rounded-full font-bold text-sm">Save</button>
            </div>
          ) : (
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
              <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white tracking-tight hover:underline decoration-green-500 truncate max-w-full">{playlist.name}</h1>
              <Edit2 size={20} className="text-zinc-400 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          )}

          <p className="text-zinc-400 text-xs sm:text-sm font-medium flex items-center justify-center md:justify-start space-x-2">
            <span className="text-white font-bold">You</span>
            <span>•</span>
            <span>{playlist.songs.length} tracks</span>
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 mt-4 sm:mt-6">
            {playlist.songs.length > 0 && (
              <>
                <button
                  onClick={() => playSong(playlist.songs[0], playlist.songs)}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg touch-manipulation flex-shrink-0"
                  title="Play playlist"
                >
                  <Play size={24} className="fill-current ml-0.5" />
                </button>
                <button
                  onClick={() => shufflePlay(playlist.songs)}
                  className="flex items-center space-x-1.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-bold transition-all shadow-md border border-zinc-700 touch-manipulation"
                  title="Shuffle playlist"
                >
                  <Shuffle size={18} className="text-green-500" />
                  <span className="text-xs sm:text-sm">Shuffle</span>
                </button>
                
                <button
                  onClick={handleDownload}
                  disabled={isDownloading || isDownloaded || playlist.songs.length === 0}
                  className={`flex items-center space-x-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-full font-bold transition-all shadow-md border touch-manipulation ${
                    isDownloaded 
                      ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                      : isDownloading || playlist.songs.length === 0
                        ? 'bg-zinc-800 text-green-400 border-green-500/50 opacity-50 cursor-not-allowed'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700 active:scale-95'
                  }`}
                  title={isDownloaded ? "Downloaded" : "Download Playlist"}
                >
                  {isDownloaded ? (
                    <CheckCircle2 size={18} className="text-green-400" />
                  ) : isDownloading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                  ) : (
                    <Download size={18} className={isDownloaded ? "text-green-400" : "text-zinc-400"} />
                  )}
                  <span className="text-xs sm:text-sm">
                    {isDownloaded ? 'Saved' : isDownloading ? `${Math.round(downloadProgress * 100)}%` : 'Download'}
                  </span>
                </button>
              </>
            )}

            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center space-x-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-bold transition-all shadow-md border border-zinc-700 cursor-pointer touch-manipulation"
              title="Share Playlist"
            >
              <Share2 size={17} className="text-green-400" />
              <span className="text-xs sm:text-sm">Share</span>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full bg-zinc-900/80 hover:bg-red-950/60 active:scale-95 text-zinc-400 hover:text-red-400 font-medium transition-all shadow-md border border-zinc-800 hover:border-red-800/60 cursor-pointer touch-manipulation"
              title="Delete Playlist"
            >
              <Trash2 size={17} />
              <span className="text-xs sm:text-sm">Delete</span>
            </button>
          </div>

          {isDownloading && (
            <p className="text-xs font-medium text-green-400 mt-3 flex items-center justify-center md:justify-start">
              {downloadStatusText}
            </p>
          )}
        </div>
      </div>

      <div className="mb-8">
         {playlist.songs.length > 0 ? (
            <div className="flex flex-col space-y-1">
              {playlist.songs.map((song, idx) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <div 
                    key={`${song.id}-${idx}`}
                    onClick={() => playSong(song, playlist.songs)}
                    className={`flex items-center p-2.5 sm:p-3 rounded-lg hover:bg-white/10 active:bg-white/15 transition-colors group cursor-pointer select-none ${
                      isCurrent ? 'bg-zinc-800/80 border border-green-500/30' : ''
                    } ${draggedIdx === idx ? 'opacity-50 border-t-2 border-green-500' : 'opacity-100'}`}
                  >
                    {/* Index or Grip */}
                    <div 
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        handleDragStart(e, idx);
                      }}
                      onDragOver={(e) => { 
                        e.preventDefault(); 
                        e.dataTransfer.dropEffect = 'move'; 
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        handleDrop(e, idx);
                      }}
                      className="w-8 text-zinc-400 flex items-center justify-center mr-2 cursor-grab active:cursor-grabbing flex-shrink-0"
                      title="Drag to reorder"
                    >
                      {isCurrent && isPlaying ? (
                        <div className="w-4 h-4 flex items-end justify-center space-x-[2px] overflow-hidden">
                          <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0s]" style={{height: '60%'}}></div>
                          <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0.2s]" style={{height: '100%'}}></div>
                          <div className="w-1 bg-green-500 animate-[bounce_1s_infinite_0.4s]" style={{height: '80%'}}></div>
                        </div>
                      ) : (
                        <>
                          <span className="group-hover:hidden text-xs sm:text-sm">{idx + 1}</span>
                          <GripVertical size={16} className="hidden group-hover:block text-zinc-400" />
                        </>
                      )}
                    </div>

                    {/* Cover Art */}
                    <img 
                      src={song.coverUrl} 
                      alt={song.title} 
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-md mr-3 object-cover flex-shrink-0 shadow-sm" 
                      onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }} 
                    />

                    {/* Title & Artist */}
                    <div className="flex-1 min-w-0 pr-2">
                      <p className={`font-medium truncate text-sm sm:text-base ${isCurrent ? 'text-green-500 font-semibold' : 'text-white'}`}>
                        {song.title}
                      </p>
                      <p className="text-xs sm:text-sm text-zinc-400 truncate hover:underline">
                        {song.artist}
                      </p>
                    </div>

                    {/* Actions (visible on mobile, hover on desktop) */}
                    <div className="flex items-center space-x-1 sm:space-x-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(song, playlist.songs);
                        }} 
                        className="p-2 hover:text-green-400 text-zinc-300 transition-colors"
                        title={isCurrent && isPlaying ? "Playing" : "Play"}
                      >
                        <Play size={18} className={isCurrent && isPlaying ? "fill-green-500 text-green-500" : "fill-current"} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSong(song.id);
                        }} 
                        className="p-2 hover:text-red-400 text-zinc-400 transition-colors"
                        title="Remove from playlist"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
         ) : (
            <div className="text-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
               <h2 className="text-2xl font-bold text-white mb-4">Let's find something for your playlist</h2>
               <p className="text-zinc-400 font-medium">Head over to Search to add songs.</p>
            </div>
         )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-white space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center space-x-3 text-red-500">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <h3 className="text-xl font-bold text-white">Delete Playlist</h3>
            </div>
            
            <p className="text-zinc-400 text-sm">
              Are you sure you want to delete <span className="text-white font-bold">"{playlist.name}"</span>? This action cannot be undone.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeletePlaylist}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-900/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Playlist Modal */}
      <SharePlaylistModal
        playlist={playlist}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
};
