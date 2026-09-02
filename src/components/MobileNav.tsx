import React, { useEffect, useState } from 'react';
import { Home, Search, Library, Compass, Download } from 'lucide-react';

interface MobileNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onViewChange }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'library', label: 'Library', icon: Library },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 flex items-center justify-around z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-colors ${
              isActive ? 'text-white' : 'text-zinc-400'
            }`}
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}

      <button
        onClick={handleInstallPWA}
        className="flex flex-col items-center justify-center space-y-1 w-full h-full text-green-500 hover:text-green-400 transition-colors"
        title="Install PWA"
      >
        <Download size={22} />
        <span className="text-[10px] font-bold">PWA</span>
      </button>

      {showInstallModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 text-left" onClick={() => setShowInstallModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-white space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center flex-shrink-0">
                <Download size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Install Spotify Clone</h3>
                <p className="text-xs text-zinc-400">Add to Home Screen / Taskbar</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-zinc-300 bg-zinc-800/60 p-4 rounded-xl border border-zinc-700/50">
              <p className="font-bold text-white text-xs uppercase tracking-wider">How to Install:</p>
              <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed text-zinc-300">
                <li>Tap your browser menu (<span className="text-white font-bold">⋮</span> or Share <span className="text-white font-bold">⎋</span>).</li>
                <li>Select <span className="text-green-400 font-bold">"Add to Home Screen"</span> or <span className="text-green-400 font-bold">"Install App"</span>.</li>
                <li>Follow the prompt to pin it to your device!</li>
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
