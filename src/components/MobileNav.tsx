import React, { useState } from 'react';
import { Home, Search, Library, Compass, Download, X, Laptop, Smartphone, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface MobileNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onViewChange }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleInstallPWA = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowInstallModal(true);
      }
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
            <Icon size={22} className={isActive ? 'text-green-500' : ''} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}

      {!isInstalled && (
        <button
          onClick={handleInstallPWA}
          className="flex flex-col items-center justify-center space-y-1 w-full h-full text-green-400 hover:text-green-300 transition-colors"
          title="Download App (PWA)"
        >
          <div className="p-1 rounded-full bg-green-500/10">
            <Download size={18} />
          </div>
          <span className="text-[10px] font-bold">Install</span>
        </button>
      )}

      {showInstallModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 text-left" onClick={() => setShowInstallModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-white space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold">Install Spotify Clone</h3>
                  <p className="text-xs text-zinc-400">Full Progressive Web App</p>
                </div>
              </div>
              <button onClick={() => setShowInstallModal(false)} className="text-zinc-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2.5 text-xs text-zinc-300 bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-700/50">
                <p className="font-bold text-white text-xs uppercase tracking-wider">Install on iOS / iPhone:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Tap the <strong>Share</strong> button (box with arrow) in Safari.</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top-right corner.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-zinc-300 bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-700/50">
                <p className="font-bold text-white text-xs uppercase tracking-wider">Install on Android / Mobile:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Tap your browser menu (<span className="font-mono">⋮</span>).</li>
                  <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li>Follow the prompt to pin it to your apps screen!</li>
                </ol>
              </div>
            )}

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 bg-green-500 text-black font-bold text-xs rounded-xl hover:bg-green-400 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

