const fs = require('fs');
let code = fs.readFileSync('src/components/ExpandedPlayer.tsx', 'utf8');

code = code.replace(
  "onClick={() => { alert(`Sleep timer set for ${mins} minutes (mock)`); setShowSleepTimer(false); }}",
  "onClick={() => { setShowSleepTimer(false); }}"
);

fs.writeFileSync('src/components/ExpandedPlayer.tsx', code);
