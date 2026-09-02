import React, { useState, useEffect, useMemo } from 'react';
import { Playlist } from '../types';
import { sharePlaylist, encodePlaylistPayload } from '../api';
import { Share2, Copy, Check, QrCode, X, Smartphone, Globe, Music, Sparkles, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';

interface SharePlaylistModalProps {
  playlist: Playlist;
  isOpen: boolean;
  onClose: () => void;
}

export const SharePlaylistModal: React.FC<SharePlaylistModalProps> = ({
  playlist,
  isOpen,
  onClose,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<'vercel' | 'current'>('vercel');
  const [shareId, setShareId] = useState(playlist.shareId || '');
  const [isCopied, setIsCopied] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Determine origins
  const vercelOrigin = 'https://spotify-rayyan.vercel.app';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : vercelOrigin;
  const activeOrigin = selectedDomain === 'vercel' ? vercelOrigin : currentOrigin;

  // Compute clean share URL and self-contained payload URL
  const cleanShareUrl = useMemo(() => {
    if (!shareId) return '';
    return `${activeOrigin}/?share=${encodeURIComponent(shareId)}`;
  }, [activeOrigin, shareId]);

  const fullPayloadUrl = useMemo(() => {
    if (!shareId) return cleanShareUrl;
    try {
      const payload = encodePlaylistPayload({ ...playlist, shareId });
      if (payload) {
        return `${activeOrigin}/?share=${encodeURIComponent(shareId)}#d=${payload}`;
      }
    } catch {}
    return cleanShareUrl;
  }, [activeOrigin, shareId, playlist, cleanShareUrl]);

  // Primary URL displayed and copied: Self-contained payload link with embedded compressed playlist
  const displayUrl = fullPayloadUrl;

  // Initialize and persist share ID
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsSyncing(true);

    // Sync to backend and obtain deterministic shareId
    sharePlaylist(playlist)
      .then((result) => {
        if (!isMounted) return;
        if (result.shareId) {
          setShareId(result.shareId);
        }
        setIsSyncing(false);
      })
      .catch((e) => {
        console.error('Share link generation failed:', e);
        if (isMounted) {
          if (!shareId) {
            setShareId(`pl_${Math.random().toString(36).substring(2, 9)}`);
          }
          setIsSyncing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, playlist.id]);

  // Generate QR Code whenever cleanShareUrl changes
  useEffect(() => {
    if (!cleanShareUrl) return;

    let isMounted = true;
    setQrError(false);

    // If payload fits comfortably in QR code (< 900 chars), encode full self-contained payload URL
    // so any phone camera scans and imports all songs without contacting any backend database!
    const urlToEncode = (fullPayloadUrl && fullPayloadUrl.length <= 900)
      ? fullPayloadUrl
      : cleanShareUrl.split('#')[0].trim();

    // Generate standard QR code
    QRCode.toDataURL(urlToEncode, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'L',
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setQrError(false);
        }
      })
      .catch((err) => {
        console.warn('Local QR generation fallback to cloud renderer:', err);
        if (isMounted) {
          // Fallback to high-reliability QR renderer service
          const fallbackQr = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(urlToEncode)}`;
          setQrDataUrl(fallbackQr);
          setQrError(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cleanShareUrl]);

  const handleCopyLink = async () => {
    const textToCopy = displayUrl;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      const input = document.createElement('input');
      input.value = textToCopy;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleCopyCode = async () => {
    if (!shareId) return;
    try {
      await navigator.clipboard.writeText(shareId);
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 2500);
    } catch {
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share && displayUrl) {
      try {
        await navigator.share({
          title: `${playlist.name} - Spotify Clone`,
          text: `Listen to "${playlist.name}" (${playlist.songs.length} tracks) on Spotify Clone:`,
          url: displayUrl,
        });
      } catch {
        // User dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${playlist.name.replace(/\s+/g, '_')}_qr.png`;
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-white space-y-5 my-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 text-black flex items-center justify-center shadow-lg flex-shrink-0">
              <Share2 size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Share Playlist</span>
                <Sparkles size={16} className="text-green-400" />
              </h3>
              <p className="text-xs text-zinc-400">
                Constant link for cross-device access & instant sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Playlist Preview Card */}
        <div className="flex items-center space-x-4 p-3.5 rounded-2xl bg-zinc-800/70 border border-zinc-700/60 shadow-inner">
          <div className="w-14 h-14 rounded-xl bg-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center shadow">
            {playlist.songs.length > 0 && playlist.songs[0].coverUrl ? (
              <img
                src={playlist.songs[0].coverUrl}
                alt={playlist.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg';
                }}
              />
            ) : (
              <Music size={24} className="text-zinc-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-white text-base truncate">{playlist.name}</h4>
            <p className="text-xs text-zinc-300 flex items-center gap-1.5 mt-0.5">
              <span className="text-green-400 font-semibold">{playlist.songs.length} songs</span>
              <span>•</span>
              <span className="text-zinc-400">Full Audio & Metadata</span>
            </p>
          </div>
        </div>

        {/* Target Domain Selector */}
        <div className="bg-zinc-950/70 p-3 rounded-2xl border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Share Domain
            </span>
            <span className="text-[11px] text-green-400 font-semibold">
              {selectedDomain === 'vercel' ? 'spotify-rayyan.vercel.app' : 'Current Preview Host'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedDomain('vercel')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedDomain === 'vercel'
                  ? 'bg-green-500 text-black shadow-md font-extrabold'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span>vercel.app (Primary)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDomain('current')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedDomain === 'current'
                  ? 'bg-green-500 text-black shadow-md font-extrabold'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span>Current Host</span>
            </button>
          </div>
        </div>

        {/* Share Link Input Box */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
            Constant Shareable Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                readOnly
                value={isSyncing && !displayUrl ? 'Generating permanent link...' : displayUrl}
                onClick={handleCopyLink}
                className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-green-500 pr-10 cursor-pointer selection:bg-green-500/30"
              />
            </div>
            <button
              onClick={handleCopyLink}
              disabled={!displayUrl}
              className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                isCopied
                  ? 'bg-green-500 text-black scale-105'
                  : 'bg-green-500 hover:bg-green-400 text-black hover:scale-105'
              }`}
            >
              {isCopied ? (
                <>
                  <Check size={16} className="stroke-[3]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share Code & Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowQr(!showQr)}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border transition-all shadow cursor-pointer ${
              showQr
                ? 'bg-green-500/20 border-green-500/40 text-green-400'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700/80'
            }`}
          >
            <QrCode size={16} className={showQr ? 'text-green-400' : 'text-zinc-400'} />
            <span>{showQr ? 'Hide QR Code' : 'Show QR Code'}</span>
          </button>

          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700/80 transition-all shadow cursor-pointer"
            >
              <Smartphone size={16} className="text-blue-400" />
              <span>Share to Apps</span>
            </button>
          ) : (
            <button
              onClick={handleCopyCode}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700/80 transition-all shadow cursor-pointer"
            >
              <Globe size={16} className="text-purple-400" />
              <span>{isCodeCopied ? 'Code Copied!' : `Code: ${shareId || '...'}`}</span>
            </button>
          )}
        </div>

        {/* QR Code Expansion Panel */}
        <AnimatePresence>
          {showQr && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col items-center justify-center p-5 bg-zinc-950 rounded-2xl border border-zinc-800 text-center space-y-3"
            >
              <div className="p-3 bg-white rounded-2xl shadow-2xl flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Playlist QR Code"
                    className="w-52 h-52 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-52 h-52 flex flex-col items-center justify-center text-zinc-600 gap-2">
                    <RefreshCw className="animate-spin text-green-500" size={24} />
                    <span className="text-xs font-semibold text-zinc-500">Generating QR...</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-white">
                  Scan to import "{playlist.name}" on any device
                </p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  {cleanShareUrl}
                </p>
              </div>

              {qrDataUrl && (
                <button
                  onClick={handleDownloadQr}
                  className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-semibold px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download QR Image</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works note */}
        <div className="p-3.5 rounded-2xl bg-zinc-800/40 border border-zinc-800 text-xs text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-300">💡 Instant Multi-Device Sync</p>
          <p className="leading-relaxed text-[11px]">
            When you open this link or scan the QR code on your phone or computer, the entire playlist with all its tracks is automatically downloaded into your library!
          </p>
        </div>
      </motion.div>
    </div>
  );
};
