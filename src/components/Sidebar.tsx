import React, { useEffect, useState } from 'react';
import { Home, Search, Library, Plus, Compass, Download } from 'lucide-react';
import { getPlaylists, createPlaylist } from '../api';
import { Playlist } from '../types';
import { motion } from 'motion/react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const load = () => setPlaylists(getPlaylists());
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

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

      {/* PWA Download Button at Very Bottom */}
      <div className="pt-4 border-t border-zinc-800">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleInstallPWA}
          className="flex items-center space-x-3 w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all shadow-md border border-zinc-700/80 group"
        >
          <div className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center group-hover:bg-green-500 group-hover:text-black transition-colors">
            <Download size={16} />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-bold truncate text-white">Install App / PWA</p>
            <p className="text-[10px] text-zinc-400 truncate">Pin to Taskbar & Start</p>
          </div>
        </motion.button>
      </div>

      {showInstallModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowInstallModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-white space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                <Download size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Install Spotify Clone</h3>
                <p className="text-xs text-zinc-400">Pin to Taskbar, Start, or Home Screen</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-zinc-300 bg-zinc-800/60 p-4 rounded-xl border border-zinc-700/50">
              <p className="font-bold text-white text-xs uppercase tracking-wider">How to Install & Pin:</p>
              <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed text-zinc-300">
                <li>Look at your browser's top-right address bar.</li>
                <li>Click the <span className="text-green-400 font-bold">Install App</span> icon or open <span className="text-white font-bold">Browser Menu (⋮ / •••)</span>.</li>
                <li>Select <span className="text-white font-bold">"Install Spotify Clone"</span> or <span className="text-white font-bold">"Add to Home Screen / Taskbar"</span>.</li>
                <li>Once installed, right-click the desktop icon to <span className="text-green-400 font-bold">"Pin to Taskbar"</span> or <span className="text-green-400 font-bold">"Pin to Start"</span>.</li>
              </ol>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
