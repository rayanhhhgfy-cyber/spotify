import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, CheckCircle, X, ExternalLink, Laptop, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'banner' | 'pill' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'sidebar', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      const success = await install();
      setIsInstalling(false);
      if (!success) {
        // User cancelled or prompt failed, show fallback guide
        setShowGuide(true);
      }
    } else {
      // In iOS or desktop browser where beforeinstallprompt isn't immediately triggered
      setShowGuide(true);
    }
  };

  if (isInstalled) {
    if (variant === 'compact') return null;
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/60 border border-green-500/20 text-xs text-green-400 font-medium ${className}`}>
        <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
        <span className="truncate">Spotify App Installed</span>
      </div>
    );
  }

  return (
    <>
      {variant === 'sidebar' && (
        <button
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-zinc-800 hover:to-zinc-700 text-white border border-zinc-700/60 hover:border-green-500/50 transition-all shadow-md group cursor-pointer ${className}`}
          title="Install as full Progressive Web App"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-black flex items-center justify-center transition-colors flex-shrink-0">
              <Download size={15} />
            </div>
            <div className="text-left truncate">
              <p className="text-xs font-bold text-zinc-200 group-hover:text-white leading-tight">Install App (PWA)</p>
              <p className="text-[10px] text-zinc-400 truncate">No store download needed</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 group-hover:bg-green-500/20 group-hover:text-green-400 flex-shrink-0">
            Free
          </span>
        </button>
      )}

      {variant === 'pill' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 hover:bg-green-400 text-black font-bold text-xs shadow-lg hover:scale-105 transition-all cursor-pointer ${className}`}
        >
          <Download size={14} className="stroke-[2.5]" />
          <span>Install App</span>
        </button>
      )}

      {variant === 'banner' && (
        <div className={`p-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-800 shadow-xl ${className}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-green-500 text-black flex items-center justify-center shadow-md">
                <Smartphone size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Download Progressive Web App</h4>
                <p className="text-xs text-zinc-400">Install directly onto your home screen or desktop with offline mode.</p>
              </div>
            </div>
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>{isInstalling ? 'Installing...' : 'Install Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Cross-platform PWA Install Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowGuide(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-white space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center">
                    <Download size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Install Spotify Clone (PWA)</h3>
                    <p className="text-xs text-zinc-400">Install as a standalone native-like app</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {isIOS ? (
                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="flex items-start space-x-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-white">Tap the Share Button</p>
                      <p className="text-xs text-zinc-400">In Safari toolbar at the bottom or top of your screen.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-white">Select "Add to Home Screen"</p>
                      <p className="text-xs text-zinc-400">Scroll down in the share sheet and tap Add to Home Screen.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="flex items-start space-x-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
                    <Laptop size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Chrome / Edge / Desktop</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Click the <strong>Install App icon</strong> (<Download size={12} className="inline mx-0.5" />) in your browser's address bar, or click browser menu (<span className="font-mono">⋮</span>) &rarr; <strong>"Install Spotify Clone"</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
                    <Smartphone size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Android / Mobile Browser</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Tap browser menu (<span className="font-mono">⋮</span>) &rarr; tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                      </p>
                    </div>
                  </div>

                  {window.self !== window.top && (
                    <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/50 text-xs text-blue-200 flex items-start gap-2.5">
                      <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Running inside AI Studio Preview</p>
                        <p className="text-[11px] text-blue-300/80 mt-0.5">
                          To trigger the one-click system install dialog, open the app in a new tab first.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                {window.self !== window.top && (
                  <button
                    onClick={() => {
                      window.open(window.location.href, '_blank');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink size={13} />
                    <span>Open in New Tab</span>
                  </button>
                )}
                <button
                  onClick={() => setShowGuide(false)}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-xs transition-colors shadow-lg"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
