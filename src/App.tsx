import React, { useState } from 'react';
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

export default function App() {
  const [currentView, setCurrentView] = useState('home');

  return (
    <PlayerProvider>
      <div className="flex h-screen bg-black text-white overflow-hidden font-sans selection:bg-green-500/30">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        
        <main className="flex-1 overflow-y-auto bg-zinc-900 bg-gradient-to-b from-zinc-800 to-black relative">
          {currentView === 'home' && <HomeView />}
          {currentView === 'search' && <SearchView />}
          {currentView === 'library' && <LibraryView onViewChange={setCurrentView} />}
          {currentView === 'discover' && <DiscoverView />}
          {currentView === 'queue' && <QueueView />}
          {currentView.startsWith('playlist:') && <PlaylistView playlistId={currentView.split(':')[1]} />}
        </main>
      </div>
      
      <PlayerBar onViewChange={setCurrentView} currentView={currentView} />
      <MobileNav currentView={currentView} onViewChange={setCurrentView} />
    </PlayerProvider>
  );
}
