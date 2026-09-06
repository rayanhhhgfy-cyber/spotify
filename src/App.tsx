import React, { useState, useEffect } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { PlayerBar } from './components/PlayerBar';
import { HomeView } from './views/HomeView';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';
import { PlaylistView } from './views/PlaylistView';
import { QueueView } from './views/QueueView';
import { DiscoverView } from './views/DiscoverView';
import { motion, AnimatePresence } from 'motion/react';
import { importSharedPlaylist, reconcileDownloads } from './api';
import { CheckCircle2, Sparkles, X } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle?: string } | null>(null);

  // Request persistent storage and reconcile offline downloads on startup
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((persistent) => {
        if (persistent) {
          console.log('Browser granted permanent persistent storage.');
        } else {
          console.log('Storage is best-effort (may be cleared if device is full).');
        }
      }).catch(console.error);
    }
    reconcileDownloads().catch(console.warn);
  }, []);

  // Check and import shared playlist on startup if URL contains share params or payload
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fullUrl = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const hasShare = urlParams.has('share') || 
                     urlParams.has('shared_playlist') || 
                     urlParams.has('playlist') || 
                     urlParams.has('data') || 
                     window.location.hash.includes('d=') || 
                     window.location.hash.includes('share=') ||
                     window.location.hash.includes('data=');

    if (hasShare) {
      importSharedPlaylist(fullUrl)
        .then((imported) => {
          if (imported) {
            setCurrentView(`playlist:${imported.id}`);
            setToastMessage({
              title: `Loaded Shared Playlist: "${imported.name}"`,
              subtitle: `${imported.songs.length} tracks added to your library!`,
            });
            setTimeout(() => setToastMessage(null), 5000);

            // Clean up the URL query parameter & hash cleanly without reloading
            const cleanPath = window.location.pathname;
            window.history.replaceState({}, document.title, cleanPath);
          }
        })
        .catch((err) => {
          console.error('Failed to import shared playlist from URL:', err);
        });
    }
  }, []);

  return (
    <PlayerProvider>
      <div className="flex h-screen bg-black text-white overflow-hidden font-sans selection:bg-green-500/30 relative">
        {/* Top Toast Banner */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[150] max-w-md w-[90%] bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-green-500/40 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                    <span>{toastMessage.title}</span>
                    <Sparkles size={14} className="text-green-400 flex-shrink-0" />
                  </p>
                  {toastMessage.subtitle && (
                    <p className="text-xs text-zinc-400 truncate">{toastMessage.subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        
        <main className="flex-1 overflow-y-auto bg-zinc-900 bg-gradient-to-b from-zinc-800 to-black relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="h-full"
            >
              {currentView === 'home' && <HomeView />}
              {currentView === 'search' && <SearchView onViewChange={setCurrentView} />}
              {currentView === 'library' && <LibraryView onViewChange={setCurrentView} />}
              {currentView === 'discover' && <DiscoverView />}
              {currentView === 'queue' && <QueueView />}
              {currentView.startsWith('playlist:') && (
                <PlaylistView 
                  playlistId={currentView.split(':')[1]} 
                  onViewChange={setCurrentView} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      
      <PlayerBar onViewChange={setCurrentView} currentView={currentView} />
      <MobileNav currentView={currentView} onViewChange={setCurrentView} />
    </PlayerProvider>
  );
}
