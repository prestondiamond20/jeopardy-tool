// Shared theme system — one source of truth so host, player, and display pages
// always render a chosen theme identically.
const THEMES = {
  classic: {
    label: 'Classic (Navy & Gold)',
    vars: {
      '--bg':'#071433', '--panel':'#0b1d4d', '--panel-border':'#22306b',
      '--accent':'#f0c14b', '--accent-dim':'#c79a2e', '--text':'#f5f7ff',
      '--muted':'#8fa0d6', '--good':'#3fb27f', '--bad':'#e0554e',
      '--display-font':'Georgia, "Times New Roman", serif', '--body-font':"'Trebuchet MS', Verdana, sans-serif",
      '--radius':'10px'
    }
  },
  pokemon: {
    label: 'Pokémon (Red & Yellow)',
    vars: {
      '--bg':'#1a1410', '--panel':'#cc2222', '--panel-border':'#ffcb05',
      '--accent':'#ffcb05', '--accent-dim':'#e0a800', '--text':'#fffdf5',
      '--muted':'#ffe27a', '--good':'#3b9c3b', '--bad':'#2a2ab0',
      '--display-font':"'Trebuchet MS', Verdana, sans-serif", '--body-font':"'Trebuchet MS', Verdana, sans-serif",
      '--radius':'18px'
    }
  },
  space: {
    label: 'Deep Space',
    vars: {
      '--bg':'#05040f', '--panel':'#120e2e', '--panel-border':'#4a3a9e',
      '--accent':'#8bd3ff', '--accent-dim':'#5aa8d6', '--text':'#eef1ff',
      '--muted':'#8f8ad6', '--good':'#4fd6a0', '--bad':'#ff6b81',
      '--display-font':"'Trebuchet MS', Verdana, sans-serif", '--body-font':"'Trebuchet MS', Verdana, sans-serif",
      '--radius':'6px'
    }
  },
  neon: {
    label: 'Retro Neon',
    vars: {
      '--bg':'#0a0014', '--panel':'#1a0a2e', '--panel-border':'#ff2fd6',
      '--accent':'#39ffce', '--accent-dim':'#22c9a1', '--text':'#fdf6ff',
      '--muted':'#ff8ae6', '--good':'#39ffce', '--bad':'#ff2f6d',
      '--display-font':"'Trebuchet MS', Verdana, sans-serif", '--body-font':"'Trebuchet MS', Verdana, sans-serif",
      '--radius':'4px'
    }
  }
};

// customVars (optional) is a partial map of the same CSS var names, used when
// name === 'custom' to override a classic-theme baseline with the host's own colors.
function applyTheme(name, customVars){
  const root = document.documentElement;
  if (name === 'custom' && customVars){
    const vars = Object.assign({}, THEMES.classic.vars, customVars);
    Object.entries(vars).forEach(([k,v]) => root.style.setProperty(k, v));
    document.body.dataset.theme = 'custom';
    return;
  }
  const theme = THEMES[name] || THEMES.classic;
  Object.entries(theme.vars).forEach(([k,v]) => root.style.setProperty(k, v));
  document.body.dataset.theme = name in THEMES ? name : 'classic';
}
