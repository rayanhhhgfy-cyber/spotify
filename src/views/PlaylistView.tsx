import React, { useEffect, useState } from 'react';
import { getPlaylists, deletePlaylist, removeSongFromPlaylist, renamePlaylist, reorderPlaylistSongs } from '../api';
import { Playlist, Song } from '../types';
import { Music, Trash2, Edit2, GripVertical, Play, Shuffle } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface PlaylistViewProps {
  playlistId: string;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistId }) => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const { playSong, shufflePlay } = usePlayer();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    const load = () => {
      const p = getPlaylists().find(p => p.id === playlistId);
      if (p) {
        setPlaylist(p);
        if (!newName) setNewName(p.name);
      } else {
        setPlaylist(null);
      }
    };
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [playlistId]);

  if (!playlist) {
    return <div className="px-6 py-20 text-center text-zinc-400">Playlist not found</div>;
  }

  const handleRename = () => {
    if (newName.trim()) {
      renamePlaylist(playlist.id, newName.trim());
      setPlaylist({...playlist, name: newName.trim()});
      setIsEditing(false);
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

  return (
    <div className="px-6 py-8 pb-32 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row items-center md:items-end space-y-6 md:space-y-0 md:space-x-6 mb-8 text-center md:text-left">
        <div className="w-48 h-48 rounded-xl bg-zinc-800 flex items-center justify-center shadow-xl overflow-hidden group">
          {playlist.songs.length > 0 ? (
            <img 
              src={(playlist.songs[0].coverUrl || '').replace('300x300', '600x600')} 
              alt="Cover" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
              onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }}
            />
          ) : (
            <Music size={64} className="text-zinc-600 shadow-sm" />
          )}
        </div>
        <div className="pb-2 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-white mb-2">Playlist</p>
          
          {isEditing ? (
            <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
              <input 
                type="text" 
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="bg-zinc-800 text-3xl md:text-5xl font-black text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full max-w-md"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleRename()}
              />
              <button onClick={handleRename} className="bg-green-500 text-black px-4 py-2 rounded-full font-bold">Save</button>
            </div>
          ) : (
            <div className="flex items-center justify-center md:justify-start gap-4 mb-4 group cursor-pointer" onClick={() => setIsEditing(true)}>
              <h1 className="text-4xl md:text-7xl font-black text-white tracking-tighter hover:underline decoration-green-500">{playlist.name}</h1>
              <Edit2 size={24} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          <p className="text-zinc-300 font-medium flex items-center justify-center md:justify-start space-x-2">
            <span className="text-white font-bold">You</span>
            <span>•</span>
            <span>{playlist.songs.length} songs</span>
          </p>

          {playlist.songs.length > 0 && (
            <div className="flex items-center justify-center md:justify-start space-x-4 mt-6">
              <button
                onClick={() => playSong(playlist.songs[0], playlist.songs)}
                className="w-14 h-14 rounded-full bg-green-500 text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
                title="Play playlist"
              >
                <Play size={26} className="fill-current ml-1" />
              </button>
              <button
                onClick={() => shufflePlay(playlist.songs)}
                className="flex items-center space-x-2 px-6 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold hover:scale-105 transition-all shadow-md border border-zinc-700"
                title="Shuffle playlist"
              >
                <Shuffle size={20} className="text-green-500" />
                <span>Shuffle</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
         {playlist.songs.length > 0 ? (
            <div className="flex flex-col space-y-1">
              {playlist.songs.map((song, idx) => (
                <div 
                  key={`${song.id}-${idx}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`flex items-center p-3 rounded-md hover:bg-white/10 transition-colors group cursor-grab active:cursor-grabbing ${draggedIdx === idx ? 'opacity-50 border-t-2 border-green-500' : 'opacity-100'}`}
                >
                  <div className="w-8 text-zinc-500 flex items-center justify-center mr-2">
                    <span className="group-hover:hidden">{idx + 1}</span>
                    <GripVertical size={16} className="hidden group-hover:block" />
                  </div>
                  <img src={song.coverUrl} alt={song.title} className="w-10 h-10 rounded mr-4 object-cover" onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{song.title}</p>
                    <p className="text-sm text-zinc-400 truncate">{song.artist}</p>
                  </div>
                  <div className="flex items-center space-x-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => playSong(song, playlist.songs)} className="p-2 hover:text-green-500 text-zinc-300 transition-colors">
                      <Play size={20} className="fill-current" />
                    </button>
                    <button onClick={() => handleDeleteSong(song.id)} className="p-2 hover:text-red-500 text-zinc-400 transition-colors">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
         ) : (
            <div className="text-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
               <h2 className="text-2xl font-bold text-white mb-4">Let's find something for your playlist</h2>
               <p className="text-zinc-400 font-medium">Head over to Search to add songs.</p>
            </div>
         )}
      </div>
    </div>
  );
};
