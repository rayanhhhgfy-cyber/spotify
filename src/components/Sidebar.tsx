import React, { useEffect, useState } from 'react';
import { Home, Search, Library, Plus, Compass } from 'lucide-react';
import { getPlaylists, createPlaylist } from '../api';
import { Playlist } from '../types';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    const load = () => setPlaylists(getPlaylists());
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'library', label: 'Your Library', icon: Library },
  ];

  const handleCreatePlaylist = () => {
    const newPlaylist = createPlaylist(`My Playlist #${playlists.length + 1}`);
    setPlaylists(getPlaylists());
    onViewChange(`playlist:${newPlaylist.id}`);
  };

  return (
    <div className="hidden md:flex flex-col w-64 bg-black h-full p-6 space-y-8">
      <div className="flex items-center space-x-2 text-white font-bold text-2xl tracking-tight cursor-pointer" onClick={() => onViewChange('home')}>
        {/* Simple Spotify-like icon representation */}
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
           <div className="w-4 h-4 rounded-full border-2 border-black" />
        </div>
        <span>Spotify Clone</span>
      </div>
      
      <nav className="space-y-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex items-center space-x-4 w-full text-sm font-semibold transition-colors duration-200 ${
                isActive ? 'text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Icon size={24} className={isActive ? 'text-white' : 'text-zinc-400'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="pt-6 border-t border-zinc-800 flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center justify-between mb-4">
           <p className="text-xs text-zinc-500 font-medium tracking-wider uppercase">Playlists</p>
           <button onClick={handleCreatePlaylist} className="text-zinc-400 hover:text-white transition-colors" title="Create Playlist">
              <Plus size={16} />
           </button>
        </div>
        <div className="space-y-3 text-sm text-zinc-400 font-medium">
            <p 
              onClick={() => onViewChange('library')} 
              className={`cursor-pointer transition-colors ${currentView === 'library' ? 'text-green-500' : 'hover:text-white'}`}
            >
              Liked Songs
            </p>
            {playlists.map(p => (
              <p 
                key={p.id}
                onClick={() => onViewChange(`playlist:${p.id}`)}
                className={`cursor-pointer transition-colors truncate ${currentView === `playlist:${p.id}` ? 'text-white font-bold' : 'hover:text-white'}`}
              >
                {p.name}
              </p>
            ))}
        </div>
      </div>
    </div>
  );
};
