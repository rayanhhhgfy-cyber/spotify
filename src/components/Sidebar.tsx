import React, { useEffect, useState } from 'react';
import { Home, Search, Library, Plus, Compass, Trash2 } from 'lucide-react';
import { getPlaylists, createPlaylist, deletePlaylist } from '../api';
import { Playlist } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    const load = () => setPlaylists(getPlaylists());
    load();
    const handleUpdate = () => load();
    window.addEventListener('playlists-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    const interval = setInterval(load, 2000);
    return () => {
      window.removeEventListener('playlists-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
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
    <div className="hidden md:flex flex-col w-64 bg-black h-full p-6 space-y-6">
      <div className="flex items-center space-x-2 text-white font-bold text-2xl tracking-tight cursor-pointer" onClick={() => onViewChange('home')}>
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
           <div className="w-4 h-4 rounded-full border-2 border-black" />
        </div>
        <span className="flex items-center gap-2">
          Spotify Clone
          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">v2.4</span>
        </span>
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
              <Icon size={24} className={isActive ? 'text-green-500' : 'text-zinc-400'} />
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
        <div className="space-y-1 text-sm text-zinc-400 font-medium">
            <p 
              onClick={() => onViewChange('library')} 
              className={`cursor-pointer transition-colors py-1.5 px-2 rounded-lg ${currentView === 'library' ? 'text-green-500 bg-zinc-900/60 font-bold' : 'hover:text-white hover:bg-zinc-900/40'}`}
            >
              Liked Songs
            </p>
            {playlists.map(p => (
              <div 
                key={p.id}
                className={`group flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                  currentView === `playlist:${p.id}` 
                    ? 'text-white bg-zinc-900/80 font-bold' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                }`}
                onClick={() => onViewChange(`playlist:${p.id}`)}
              >
                <span className="truncate flex-1 pr-2">
                  {p.name}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete playlist "${p.name}"?`)) {
                      deletePlaylist(p.id);
                      if (currentView === `playlist:${p.id}`) {
                        onViewChange('library');
                      }
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-1 rounded transition-all"
                  title="Delete playlist"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* PWA Download / Install App Button at the Bottom */}
      <div className="pt-3 border-t border-zinc-800">
        <PWAInstallButton variant="sidebar" />
      </div>
    </div>
  );
};
