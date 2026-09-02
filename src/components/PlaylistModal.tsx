import React, { useState, useEffect } from 'react';
import { Song, Playlist } from '../types';
import { getPlaylists, createPlaylist, addSongToPlaylist } from '../api';
import { X, Plus } from 'lucide-react';

interface PlaylistModalProps {
  song: Song;
  onClose: () => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({ song, onClose }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    const load = () => setPlaylists(getPlaylists());
    load();
    window.addEventListener('playlists-updated', load);
    return () => window.removeEventListener('playlists-updated', load);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPlaylist = createPlaylist(newPlaylistName.trim());
    addSongToPlaylist(newPlaylist.id, song);
    onClose();
  };

  const handleAddToPlaylist = (playlistId: string) => {
    addSongToPlaylist(playlistId, song);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl border border-zinc-800 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Add to Playlist</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto">
          <form onSubmit={handleCreate} className="mb-6 flex gap-2">
            <input
              type="text"
              placeholder="New playlist name..."
              className="flex-1 bg-zinc-800 border-none rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
            />
            <button 
              type="submit"
              disabled={!newPlaylistName.trim()}
              className="bg-green-500 text-black px-4 py-2 rounded-md font-bold disabled:opacity-50 hover:bg-green-400 transition-colors"
            >
              <Plus size={20} />
            </button>
          </form>

          {playlists.length > 0 ? (
            <div className="space-y-1">
              {playlists.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAddToPlaylist(p.id)}
                  className="w-full text-left px-4 py-3 rounded-md text-zinc-300 font-medium hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              No playlists found. Create one above!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
