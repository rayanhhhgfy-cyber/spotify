const fs = require('fs');
let code = fs.readFileSync('src/context/PlayerContext.tsx', 'utf8');

// Add reorderQueue to the interface
code = code.replace(
  "toggleRepeat: () => void;",
  "toggleRepeat: () => void;\n  reorderQueue: (startIndex: number, endIndex: number) => void;"
);

// Add keyboard shortcuts and reorderQueue to the PlayerProvider
code = code.replace(
  "const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');",
  `const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          handlersRef.current.togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) handlersRef.current.nextSong();
          else if (audioRef.current) handlersRef.current.seek(audioRef.current.currentTime + 10);
          break;
        case 'ArrowLeft':
          if (e.shiftKey) handlersRef.current.prevSong();
          else if (audioRef.current) handlersRef.current.seek(Math.max(0, audioRef.current.currentTime - 10));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const reorderQueue = (startIndex: number, endIndex: number) => {
    setQueue(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };`
);

// Add reorderQueue to Provider value
code = code.replace(
  "toggleRepeat\n      }}",
  "toggleRepeat,\n        reorderQueue\n      }}"
);

fs.writeFileSync('src/context/PlayerContext.tsx', code);
