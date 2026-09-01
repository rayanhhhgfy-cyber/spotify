import React from 'react';
import { Home, Search, Library, Compass } from 'lucide-react';

interface MobileNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onViewChange }) => {
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
            <Icon size={24} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
