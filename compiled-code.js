javascript:(function(){'use strict';
/* ════════════════════════════════════════════════════════════════════
   1. UTILS MODULE
════════════════════════════════════════════════════════════════════ */
const Utils = {
  prettyKey(code) {
    const MAP = {
      Space:'SPACE', Enter:'ENTER', Escape:'ESC', Backspace:'BKSP', Tab:'TAB',
      ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→',
      ShiftLeft:'SHIFT', ShiftRight:'SHIFT',
      ControlLeft:'CTRL', ControlRight:'CTRL',
      AltLeft:'ALT', AltRight:'ALT',
    };
    if (MAP[code]) return MAP[code];
    if (code.startsWith('Key'))    return code.slice(3);
    if (code.startsWith('Digit'))  return code.slice(5);
    if (code.startsWith('Numpad')) return 'NP' + code.slice(6);
    return code;
  },
  drawPixels(ctx, ox, oy, sz, m, color) {
    ctx.fillStyle = color;
    for (let r = 0; r < m.length; r++) {
      for (let cl = 0; cl < m[r].length; cl++) {
        if (m[r][cl] === 1) ctx.fillRect(ox + cl * sz, oy + r * sz, sz, sz);
      }
    }
  },
  drawColorPixels(ctx, ox, oy, sz, m) {
    for (let r = 0; r < m.length; r++) {
      for (let cl = 0; cl < m[r].length; cl++) {
        if (m[r][cl]) {
          ctx.fillStyle = m[r][cl];
          ctx.fillRect(ox + cl * sz, oy + r * sz, sz, sz);
        }
      }
    }
  },
  rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + w2 && y1 + h1 > y2;
  }
};

/* ════════════════════════════════════════════════════════════════════
   2. STORE MODULE
════════════════════════════════════════════════════════════════════ */
const Store = {
  scores: {
    _key: 'gamehub_hi',
    get(game) { return JSON.parse(localStorage.getItem(this._key) || '{}')[game] || 0; },
    submit(game, val) {
      const all = JSON.parse(localStorage.getItem(this._key) || '{}');
      if (val > (all[game] || 0)) {
        all[game] = val;
        localStorage.setItem(this._key, JSON.stringify(all));
        return true;
      }
      return false;
    }
  },
  bindings: {
    _key: 'gamehub_bindings',
    _defs: {},
    _all() { return JSON.parse(localStorage.getItem(this._key) || '{}'); },
    register(game, controls) { this._defs[game] = controls; },
    resolve(game) {
      const defs = this._defs[game] || {};
      const stored = this._all()[game] || {};
      const out = {};
      for (const action in defs) out[action] = stored[action] || defs[action].default;
      return out;
    },
    set(game, action, code) {
      const all = this._all();
      if (!all[game]) all[game] = {};
      all[game][action] = code;
      localStorage.setItem(this._key, JSON.stringify(all));
    },
    reset(game) {
      const all = this._all();
      delete all[game];
      localStorage.setItem(this._key, JSON.stringify(all));
    }
  },
  layout: {
    _key: 'gamehub_layout',
    _default: { width: 400, position: 'bottom-left' },
    get() { try { return JSON.parse(localStorage.getItem(this._key)) || this._default; } catch(e) { return this._default; } },
    set(width, pos) {
      const cur = this.get();
      if (width !== null) cur.width = width;
      if (pos !== null) cur.position = pos;
      localStorage.setItem(this._key, JSON.stringify(cur));
      if (UI._winEl && Hub._game && Hub._game.el && Hub._game.el._aspectRatio) {
        UI.applyCanvasStyle(Hub._game.el, Hub._game.el._aspectRatio, Hub._game.el._gameName);
      }
    }
  }
};

/* ════════════════════════════════════════════════════════════════════
   3. UI MODULE
════════════════════════════════════════════════════════════════════ */
const UI = {
  _menuEl: null,
  _winEl: null,
  _hidden: false,

  makePanel(id, width, height) {
    const p = document.createElement('div');
    p.id = id;
    Object.assign(p.style, {
      position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
      background:'#121212', color:'#e0e0e0', padding:'48px 24px 24px 24px', borderRadius:'8px',
      boxShadow:'0 12px 40px rgba(0,0,0,0.9)', zIndex:'9999999',
      fontFamily:'Trebuchet MS, system-ui, sans-serif', textAlign:'center', 
      width:(width || '640px'), height:(height || '480px'),
      border:'1px solid #333', overflow:'hidden', boxSizing:'border-box',
    });
    return p;
  },

  applyCanvasStyle(canvas, aspectRatio, gameName) {
    canvas._aspectRatio = aspectRatio;
    canvas._gameName = gameName;

    const oldWin = document.getElementById('hub-game-window');
    if (oldWin) oldWin.remove();

    const layout = Store.layout.get();
    const diag = layout.width;
    const cH = Math.round(diag / Math.sqrt(aspectRatio * aspectRatio + 1));
    const cW = Math.round(cH * aspectRatio);
    const w = cW;
    const h = cH + 28;
    const pos = layout.position.split('-');
    const vPos = pos[0], hPos = pos[1];
    
    const win = document.createElement('div');
    win.id = 'hub-game-window';
    this._winEl = win;

    const styles = {
      position: 'fixed', width: w + 'px', height: h + 'px',
      background: '#000', border: '1px solid #333', borderRadius: '8px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.9)', zIndex: '999999', margin: '0',
      top: 'auto', bottom: 'auto', left: 'auto', right: 'auto', transform: 'none',
      overflow: 'hidden', display: 'flex', flexDirection: 'column'
    };

    if (vPos === 'top') styles.top = '20px';
    if (vPos === 'bottom') styles.bottom = '20px';
    if (vPos === 'center') { styles.top = '50%'; styles.transform = 'translateY(-50%)'; }
    if (hPos === 'left') styles.left = '20px';
    if (hPos === 'right') styles.right = '20px';
    if (hPos === 'center') {
      styles.left = '50%';
      styles.transform = (vPos === 'center') ? 'translate(-50%, -50%)' : 'translateX(-50%)';
    }
    Object.assign(win.style, styles);

    const titleBar = document.createElement('div');
    Object.assign(titleBar.style, {
      height: '28px', background: '#0a0a0a', borderBottom: '1px solid #222',
      display: 'flex', alignItems: 'center', paddingLeft: '12px', paddingRight: '8px', 
      boxSizing: 'border-box', fontFamily: 'Trebuchet MS, system-ui, sans-serif', flexShrink: '0'
    });

    const title = document.createElement('div');
    title.textContent = gameName;
    title.style.cssText = 'color:#888; font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:2px; pointer-events:none; flex:1;';
    
    const rightCtrl = document.createElement('div');
    Object.assign(rightCtrl.style, { display:'flex', gap:'12px', alignItems:'center' });

    const mkWinBtn = (html, hoverColor, onClick) => {
      const btn = document.createElement('button');
      btn.innerHTML = html;
      Object.assign(btn.style, {
        background:'none', border:'none', color:'#888', fontSize:'20px', cursor:'pointer',
        padding:'0', fontFamily:'inherit', transition:'color 0.1s', fontWeight:'bold', lineHeight:'1'
      });
      btn.onmouseover = () => btn.style.color = hoverColor;
      btn.onmouseout  = () => btn.style.color = '#888';
      btn.onclick = onClick;
      return btn;
    };

    rightCtrl.appendChild(mkWinBtn('←', '#ff3333', () => { Hub.stop(); UI.showMenu(); }));
    rightCtrl.appendChild(mkWinBtn('—', '#ff3333', () => UI.toggleHide()));
    rightCtrl.appendChild(mkWinBtn('✕', '#ff4c4c', () => Hub.stop()));

    titleBar.appendChild(title);
    titleBar.appendChild(rightCtrl);
    win.appendChild(titleBar);

    canvas.style.width = '100%';
    canvas.style.height = 'calc(100% - 28px)';
    canvas.style.display = 'block';
    canvas.style.border = 'none';
    canvas.style.borderRadius = '0 0 8px 8px';
    
    win.appendChild(canvas);
    document.body.appendChild(win);
  },

  toggleHide() {
    this._hidden = !this._hidden;
    const v = this._hidden ? 'none' : '';
    if (this._menuEl) this._menuEl.style.display = v;
    if (this._winEl) this._winEl.style.display = v;
    if (this._hidden) Hub.pause(); else Hub.resume();
  },

  showMenu() {
    let menu = document.getElementById('game-hub-panel');
    if (!menu) {
      menu = this.makePanel('game-hub-panel', '640px', '480px');
      document.body.appendChild(menu);
    }
    menu.innerHTML = '';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    this._menuEl = menu;

    const settingsBtn = document.createElement('button');
    settingsBtn.innerHTML = '⚙';
    Object.assign(settingsBtn.style, {
      position:'absolute', top:'16px', left:'20px', background:'none', border:'none',
      color:'#888', fontSize:'24px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Trebuchet MS, system-ui, sans-serif', transition:'color 0.1s'
    });
    settingsBtn.onmouseover = () => settingsBtn.style.color = '#ff3333';
    settingsBtn.onmouseout  = () => settingsBtn.style.color = '#888';
    settingsBtn.onclick = () => this.showSettings();
    menu.appendChild(settingsBtn);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    Object.assign(closeBtn.style, {
      position:'absolute', top:'16px', right:'20px', background:'none', border:'none',
      color:'#888', fontSize:'26px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Trebuchet MS, system-ui, sans-serif', fontWeight:'bold', transition:'color 0.1s'
    });
    closeBtn.onmouseover = () => closeBtn.style.color = '#ff4c4c';
    closeBtn.onmouseout  = () => closeBtn.style.color = '#888';
    closeBtn.onclick = () => { menu.remove(); this._menuEl=null; };
    menu.appendChild(closeBtn);

    const ttl = document.createElement('h2');
    ttl.innerText = 'GAME HUB';
    ttl.style.cssText = 'margin:0 0 8px 0;color:#fff;font-size:28px;text-transform:uppercase;letter-spacing:4px;font-weight:bold';
    menu.appendChild(ttl);
    
    const sub = document.createElement('div');
    sub.innerText = 'SELECT A GAME';
    sub.style.cssText = 'color:#ff3333;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:28px';
    menu.appendChild(sub);

    const grid = document.createElement('div');
    Object.assign(grid.style, { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'16px', flex:'1', overflow:'hidden' });

    Games.forEach(g => {
      const tile = document.createElement('div');
      const best = Store.scores.get(g.name);
      Object.assign(tile.style, {
        background:'#0a0a0a', border:'1px solid #222', borderRadius:'8px',
        cursor:'pointer', position:'relative', aspectRatio:'1 / 1', overflow:'hidden', transition:'border-color 0.1s'
      });

      const screen = document.createElement('div');
      Object.assign(screen.style, {
        background:'#121212', position:'absolute', top:'6px', left:'6px', right:'6px', bottom:'36px',
        display:'flex', justifyContent:'center', alignItems:'center', borderRadius:'6px', transition:'all 0.2s', zIndex:'0'
      });

      const iconWrap = document.createElement('div');
      iconWrap.style.cssText = 'width:60%;height:60%;display:flex;align-items:center;justify-content:center;opacity:0.8;transition:all 0.2s';
      
      if (g.icon) {
        if (g.icon.startsWith('data:image')) {
          const img = document.createElement('img');
          img.src = g.icon;
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
          iconWrap.appendChild(img);
        } else {
          // Use DOMParser to correctly apply the SVG namespace
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(g.icon, "image/svg+xml");
            const svg = doc.querySelector('svg');
            if (svg) {
              svg.setAttribute('width', '100%'); 
              svg.setAttribute('height', '100%'); 
              svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              svg.style.display = 'block';
              iconWrap.appendChild(svg);
            }
          } catch(e) {
            iconWrap.innerHTML = 'SVG Err';
          }
        }
      } else {
        const name = document.createElement('div');
        name.textContent = g.name.split(' ').map(w=>w[0]).join('').substring(0,2);
        name.style.cssText = 'font-size:32px;color:#ff3333;font-weight:bold;transition:all 0.2s';
        iconWrap.appendChild(name);
      }
      screen.appendChild(iconWrap);

      const infoContainer = document.createElement('div');
      Object.assign(infoContainer.style, {
        position:'absolute', bottom:'0', left:'0', right:'0', height:'36px',
        display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center',
        transition:'opacity 0.1s', zIndex:'1'
      });

      const title = document.createElement('div');
      title.textContent = g.name;
      title.style.cssText = 'font-size:12px;font-weight:bold;color:#e0e0e0;text-transform:uppercase;letter-spacing:1px;text-align:center;padding:0 8px';
      
      const score = document.createElement('div');
      score.style.cssText = 'font-size:10px;color:#888;text-align:center;margin-top:2px';
      score.textContent = best ? 'Best: ' + best : '—';

      infoContainer.appendChild(title);
      infoContainer.appendChild(score);
      tile.appendChild(screen);
      tile.appendChild(infoContainer);

      tile.onmouseover = () => {
        tile.style.borderColor='#ff3333';
        Object.assign(screen.style, {top:'0px',left:'0px',right:'0px',bottom:'0px',borderRadius:'0px'});
        infoContainer.style.opacity='0';
        Object.assign(iconWrap.style, {width:'85%',height:'85%',opacity:'1'});
      };
      tile.onmouseout = () => {
        tile.style.borderColor='#222';
        Object.assign(screen.style, {top:'6px',left:'6px',right:'6px',bottom:'36px',borderRadius:'6px'});
        infoContainer.style.opacity='1';
        Object.assign(iconWrap.style, {width:'60%',height:'60%',opacity:'0.8'});
      };
      tile.onclick = () => { menu.style.display = 'none'; Hub.launch(g.factory()); };
      grid.appendChild(tile);
    });
    menu.appendChild(grid);
  },

  showSettings() {
    let panel = document.getElementById('game-hub-panel');
    if (!panel) {
      panel = this.makePanel('game-hub-panel', '640px', '480px');
      document.body.appendChild(panel);
    }
    panel.innerHTML = '';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    this._menuEl = panel;

    const backBtn = document.createElement('button');
    backBtn.innerHTML = '←';
    Object.assign(backBtn.style, {
      position:'absolute', top:'16px', left:'20px', background:'none', border:'none',
      color:'#888', fontSize:'26px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Trebuchet MS, system-ui, sans-serif', transition:'color 0.1s'
    });
    backBtn.onmouseover = () => backBtn.style.color = '#ff3333';
    backBtn.onmouseout  = () => backBtn.style.color = '#888';
    backBtn.onclick = () => { Hub._rebinding=null; this.showMenu(); };
    panel.appendChild(backBtn);

    const ttl = document.createElement('h2');
    ttl.innerText = '⚙ SETTINGS';
    ttl.style.cssText = 'margin:0 0 20px 0;color:#fff;font-size:28px;text-transform:uppercase;letter-spacing:4px;font-weight:bold';
    panel.appendChild(ttl);

    const contentRow = document.createElement('div');
    Object.assign(contentRow.style, { display:'flex', flex:'1', gap:'24px', overflow:'hidden', borderTop:'1px solid #333', paddingTop:'20px' });

    const sidebar = document.createElement('div');
    Object.assign(sidebar.style, { width:'120px', display:'flex', flexDirection:'column', gap:'8px', borderRight:'1px solid #333', paddingRight:'16px' });

    const tabs = [{ name: 'display', label: 'Display' }, { name: 'controls', label: 'Controls' }];
    const displayTab = document.createElement('div');
    Object.assign(displayTab.style, { display:'none', flex:'1', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'32px' });
    
    if (!document.getElementById('hub-scroll-style')) {
      const style = document.createElement('style');
      style.id = 'hub-scroll-style';
      style.innerHTML = '.hub-scroll::-webkit-scrollbar { width: 8px; } .hub-scroll::-webkit-scrollbar-track { background: #0a0a0a; } .hub-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; } .hub-scroll::-webkit-scrollbar-thumb:hover { background: #ff3333; } .hub-scroll { scrollbar-width: thin; scrollbar-color: #333 #0a0a0a; }';
      document.head.appendChild(style);
    }

    const controlsTab = document.createElement('div');
    controlsTab.classList.add('hub-scroll');
    Object.assign(controlsTab.style, { display:'none', flex:'1', width:'100%', overflowY:'auto', paddingRight: '8px', boxSizing: 'border-box' });

    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.textContent = t.label;
      btn.dataset.tab = t.name;
      Object.assign(btn.style, {
        textAlign:'left', background:'none', border:'none', color:'#888',
        fontSize:'16px', cursor:'pointer', padding:'10px 12px', borderRadius:'6px',
        fontFamily:'inherit', transition:'all 0.1s', width:'100%'
      });
      btn.onclick = () => {
        tabs.forEach(tt => {
          const b = sidebar.querySelector(`button[data-tab="${tt.name}"]`);
          b.style.background = 'none'; b.style.color = '#888';
        });
        btn.style.background = '#1e1e1e'; btn.style.color = '#fff';
        displayTab.style.display = t.name === 'display' ? 'flex' : 'none';
        controlsTab.style.display = t.name === 'controls' ? 'block' : 'none';
      };
      sidebar.appendChild(btn);
    });

    // Display Tab Content
    const currentLayout = Store.layout.get();
    const sizeBox = document.createElement('div');
    sizeBox.style.cssText = 'width:80%; text-align:center;';
    const sizeLabel = document.createElement('div');
    sizeLabel.textContent = 'DIAG SIZE: ' + currentLayout.width + 'px';
    sizeLabel.style.cssText = 'font-size:14px;color:#ff3333;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;font-weight:bold';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '200'; slider.max = '500'; slider.value = currentLayout.width; slider.step = '10';
    Object.assign(slider.style, { width:'100%', cursor:'pointer', accentColor:'#ff3333' });
    slider.oninput = (e) => {
      const val = parseInt(e.target.value);
      sizeLabel.textContent = 'DIAG SIZE: ' + val + 'px';
      Store.layout.set(val, null);
    };
    sizeBox.appendChild(sizeLabel);
    sizeBox.appendChild(slider);
    displayTab.appendChild(sizeBox);

    const posBox = document.createElement('div');
    posBox.style.cssText = 'text-align:center;';
    const posLabel = document.createElement('div');
    posLabel.textContent = 'POSITION';
    posLabel.style.cssText = 'font-size:14px;color:#ff3333;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;font-weight:bold';
    const posGrid = document.createElement('div');
    Object.assign(posGrid.style, { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'6px', width:'120px', height:'120px', margin:'0 auto' });
    const positions = ['top-left','top-center','top-right','center-left','center-center','center-right','bottom-left','bottom-center','bottom-right'];
    positions.forEach(p => {
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        background: currentLayout.position === p ? '#ff3333' : '#1e1e1e',
        border: '1px solid #333', borderRadius: '6px', cursor:'pointer', padding:'0', transition:'all 0.1s'
      });
      btn.onmouseover = () => { if (currentLayout.position !== p) btn.style.background = '#252525'; };
      btn.onmouseout = () => { if (currentLayout.position !== p) btn.style.background = '#1e1e1e'; };
      btn.onclick = () => { Store.layout.set(null, p); this.showSettings(); };
      posGrid.appendChild(btn);
    });
    posBox.appendChild(posLabel);
    posBox.appendChild(posGrid);
    displayTab.appendChild(posBox);

    // Controls Tab Content
    const controlsHeader = document.createElement('div');
    controlsHeader.textContent = 'Click a key to rebind. Changes apply on next launch.';
    controlsHeader.style.cssText = 'font-size:12px;color:#888;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:1px;text-align:center';
    controlsTab.appendChild(controlsHeader);

    const ctrlGrid = document.createElement('div');
    Object.assign(ctrlGrid.style, { display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px', textAlign:'left' });

    Games.forEach(g => {
      const defs = Store.bindings._defs[g.name];
      if (!Object.keys(defs).length) return;
      const gameBox = document.createElement('div');
      Object.assign(gameBox.style, { background:'#0a0a0a', border:'1px solid #222', borderRadius:'8px', padding:'10px', position:'relative', display:'flex', flexDirection:'column', gap:'6px' });

      const rst = document.createElement('button');
      rst.innerHTML = '↺';
      Object.assign(rst.style, { position:'absolute', top:'6px', right:'10px', background:'none', border:'none', color:'#444', fontSize:'16px', cursor:'pointer', padding:'0', fontFamily:'Trebuchet MS, system-ui, sans-serif', transition:'color 0.1s' });
      rst.onmouseover = () => rst.style.color = '#ff4c4c';
      rst.onmouseout  = () => rst.style.color = '#444';
      rst.onclick = () => { Store.bindings.reset(g.name); this.showSettings(); };
      gameBox.appendChild(rst);

      const hdr = document.createElement('div');
      hdr.textContent = g.name;
      hdr.style.cssText = 'font-size:12px;color:#ff3333;text-align:left;margin:0 0 4px 0;letter-spacing:1px;text-transform:uppercase;font-weight:bold;border-bottom:1px solid #222;padding-bottom:6px;';
      gameBox.appendChild(hdr);

      const resolved = Store.bindings.resolve(g.name);
      for (const action in defs) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';
        const lbl = document.createElement('span');
        lbl.textContent = defs[action].label;
        lbl.style.cssText = 'font-size:10px;color:#888;text-align:left;text-transform:uppercase;letter-spacing:1px;line-height:1.2;';
        const keyBtn = document.createElement('button');
        keyBtn.textContent = Utils.prettyKey(resolved[action]);
        Object.assign(keyBtn.style, {
          background:'#1e1e1e', color:'#e0e0e0', border:'1px solid #333', borderRadius:'4px', padding:'3px 8px', cursor:'pointer',
          fontFamily:'Trebuchet MS, system-ui, sans-serif', fontSize:'11px', minWidth:'50px', textTransform:'uppercase', fontWeight:'bold', transition:'background 0.1s, border-color 0.1s', textAlign:'center'
        });
        keyBtn.onmouseover = () => { if (!Hub._rebinding) { keyBtn.style.borderColor='#ff3333'; keyBtn.style.background='#252525'; } };
        keyBtn.onmouseout  = () => { if (!Hub._rebinding) { keyBtn.style.borderColor='#333'; keyBtn.style.background='#1e1e1e'; } };
        keyBtn.onclick = () => {
          if (Hub._rebinding) return;
          keyBtn.textContent = '...';
          Object.assign(keyBtn.style, { background:'#ff3333', color:'#000', borderColor:'#ff3333' });
          Hub._rebinding = code => {
            Store.bindings.set(g.name, action, code);
            keyBtn.textContent = Utils.prettyKey(code);
            Object.assign(keyBtn.style, { background:'#1e1e1e', color:'#e0e0e0', borderColor:'#333' });
            Hub._rebinding = null;
          };
        };
        row.appendChild(lbl);
        row.appendChild(keyBtn);
        gameBox.appendChild(row);
      }
      ctrlGrid.appendChild(gameBox);
    });
    controlsTab.appendChild(ctrlGrid);

    contentRow.appendChild(sidebar);
    contentRow.appendChild(displayTab);
    contentRow.appendChild(controlsTab);
    panel.appendChild(contentRow);
    sidebar.querySelector('button[data-tab="display"]').click();
  }
};

/* ════════════════════════════════════════════════════════════════════
   4. HUB CORE MODULE
════════════════════════════════════════════════════════════════════ */
const Hub = window.GameHub = {
  _IV: 1000 / 60,
  _last: 0, _accum: 0, _raf: null, _game: null,
  _debug: false, _rebinding: null, keys: {},

  init() {
    // Checks if all keys in the combo string are currently held down in Hub.keys
    const checkCombo = (comboStr) => {
      if (!comboStr) return false;
      const parts = comboStr.split('+');
      for (let p of parts) {
        if (!this.keys[p]) return false;
      }
      return true;
    };
    
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      // Ignore key repeat so it only triggers once per press
      if (!e.repeat) {
        if (checkCombo(HUB_KEYS.hide) && !UI._hidden) { UI.toggleHide(); return; }
        if (checkCombo(HUB_KEYS.show) && UI._hidden) { UI.toggleHide(); return; }
        if (checkCombo(HUB_KEYS.debug)) { e.preventDefault(); this._debug = !this._debug; return; }
      }
      if (this._rebinding)     { this._rebinding(e.code); return; }
      if (this._game && this._game.onKey) this._game.onKey(e.code);
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  },

  pause() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } },
  resume() {
    if (this._game && !this._raf) {
      this._accum = 0; this._last = performance.now();
      this._raf = requestAnimationFrame(t => this._loop(t));
    }
  },

  _loop(now) {
    this._raf = requestAnimationFrame(t => this._loop(t));
    const dt = Math.min(now - this._last, 100);
    this._last = now; this._accum += dt;
    while (this._accum >= this._IV) {
      if (this._game) this._game.tick();
      this._accum -= this._IV;
    }
  },

  launch(game) {
    this.stop();
    this._game = game;
    if (game.el) {
      if (!document.getElementById('hub-game-window')) {
        UI.applyCanvasStyle(game.el, game.el._aspectRatio, game.el._gameName);
      }
      if (UI._winEl) UI._winEl.style.display = UI._hidden ? 'none' : '';
    }
    this._accum = 0; this._last = performance.now();
    this._raf = requestAnimationFrame(t => this._loop(t));
  },

  stop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._game && this._game.destroy) this._game.destroy();
    this._game = null;
    if (UI._winEl) { UI._winEl.remove(); UI._winEl = null; }
  }
};
const Games = [{ name: "Geometry Dash", icon: "data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%20544%20544%22%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20xml%3Aspace%3D%22preserve%22%20xmlns%3Aserif%3D%22http%3A%2F%2Fwww.serif.com%2F%22%20style%3D%22fill-rule%3Aevenodd%3Bclip-rule%3Aevenodd%3Bstroke-linecap%3Around%3Bstroke-linejoin%3Around%3Bstroke-miterlimit%3A1.5%3B%22%3E%0A%20%20%20%20%3Cg%20id%3D%22Artboard3%22%20transform%3D%22matrix(0.816878%2C0%2C0%2C0.810518%2C2041.914411%2C184.60116)%22%3E%0A%20%20%20%20%20%20%20%20%3Crect%20x%3D%22-2499.658%22%20y%3D%22-227.757%22%20width%3D%22665.338%22%20height%3D%22670.559%22%20style%3D%22fill%3Anone%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%3CclipPath%20id%3D%22_clip1%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22-2499.658%22%20y%3D%22-227.757%22%20width%3D%22665.338%22%20height%3D%22670.559%22%2F%3E%0A%20%20%20%20%20%20%20%20%3C%2FclipPath%3E%0A%20%20%20%20%20%20%20%20%3Cg%20clip-path%3D%22url(%23_clip1)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20id%3D%22GDBackdropHalf%22%20transform%3D%22matrix(1.341522%2C0%2C0%2C1.352048%2C-1210.383325%2C-682.045028)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20id%3D%22GDBackdropLines%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(1%2C0%2C0%2C0.5%2C0%2C368)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22-1025%22%20y%3D%22-64%22%20width%3D%22800%22%20height%3D%22800%22%20style%3D%22fill%3Argb(109%2C180%2C206)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0.996292%2C0%2C0%2C2.334081%2C-3.80078%2C-982.275489)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M-840.315%2C657.168L-840.315%2C736L-1025%2C736L-1025%2C657.168L-840.315%2C657.168ZM-691.664%2C678.515L-691.664%2C736L-826.338%2C736L-826.338%2C678.515L-691.664%2C678.515ZM-498.558%2C659.859L-498.558%2C736.168L-677.333%2C736.168L-677.333%2C659.859L-498.558%2C659.859ZM-232.838%2C564.794L-232.838%2C624.295L-420.972%2C624.295L-420.972%2C564.794L-232.838%2C564.794ZM-433.59%2C603.934L-433.59%2C625.622L-484.398%2C625.622L-484.398%2C603.934L-433.59%2C603.934ZM-433.59%2C578.367L-433.59%2C600.054L-484.398%2C600.054L-484.398%2C578.367L-433.59%2C578.367ZM-499.559%2C578.367L-499.559%2C653.867L-676.438%2C653.867L-676.438%2C578.367L-499.559%2C578.367ZM-893.303%2C564.794L-893.303%2C613.529L-1025%2C613.529L-1025%2C564.794L-893.303%2C564.794ZM-689.816%2C564.794L-689.816%2C613.529L-876.856%2C613.529L-876.856%2C564.794L-689.816%2C564.794ZM-433.59%2C564.794L-433.59%2C573.81L-676.438%2C573.81L-676.438%2C564.794L-433.59%2C564.794ZM-232.838%2C629.924L-232.838%2C736.168L-481.742%2C736.168L-481.742%2C629.924L-232.838%2C629.924ZM-945.321%2C617.875L-945.321%2C651.885L-1025%2C651.885L-1025%2C617.875L-945.321%2C617.875ZM-844.193%2C617.875L-844.193%2C651.885L-923.872%2C651.885L-923.872%2C617.875L-844.193%2C617.875ZM-691.664%2C617.056L-691.664%2C674.541L-826.338%2C674.541L-826.338%2C617.056L-691.664%2C617.056Z%22%20style%3D%22fill%3Argb(100%2C160%2C201)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20id%3D%22Ground%22%20transform%3D%22matrix(1.224174%2C0%2C0%2C1.233779%2C-2416.759705%2C653.59607)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0%2C1.096914%2C-1.096914%2C0%2C-184.606265%2C-215.508384)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22-90.111%22%20y%3D%22-360%22%20width%3D%22253.438%22%20height%3D%22253.438%22%20style%3D%22fill%3Argb(92%2C155%2C198)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0.99827%2C0%2C0%2C0.99827%2C34.737958%2C57.524698)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22-90.111%22%20y%3D%22-360%22%20width%3D%22253.438%22%20height%3D%22253.438%22%20style%3D%22fill%3Argb(81%2C134%2C187)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20id%3D%22Ground1%22%20serif%3Aid%3D%22Ground%22%20transform%3D%22matrix(1.224174%2C0%2C0%2C1.233779%2C-2091.741638%2C653.59607)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0%2C1.096914%2C-1.096914%2C0%2C-184.606265%2C-215.508384)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22-90.111%22%20y%3D%22-360%22%20width%3D%22253.438%22%20height%3D%22253.438%22%20style%3D%22fill%3Argb(92%2C155%2C198)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0.99827%2C0%2C0%2C0.99827%2C34.737958%2C57.524698)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22-90.111%22%20y%3D%22-360%22%20width%3D%22253.438%22%20height%3D%22253.438%22%20style%3D%22fill%3Argb(81%2C134%2C187)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0%2C1.233779%2C-1.224174%2C0%2C-1668.189918%2C-319.047098)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cdefs%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cmask%20id%3D%22Mask%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0%2C-1%2C1%2C0%2C73.992282%2C679.207324)%22%3E%3Cimage%20id%3D%22_Image3%22%20width%3D%22544px%22%20height%3D%22544px%22%20xlink%3Ahref%3D%22data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAAiAAAAIgCAAAAACZ4o3AAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAFyUlEQVR4nO3dO5IkNRSG0YKYxUy0AwQb1moI2mMsllMYPU2%2F8iFlpnRV0jkL0P2NjM%2FN2w0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ9ix5A157%2Bil5A157vf0RPoGNP9%2Fs%2F0Rvo2PP9LiGserrfJYR1z%2Fe7hLDq6X6XENa9BERCWPYzIBLCsteASAhL%2Fg%2BIhLDkLSASwlfvAiIhfPU%2BIBLCZx8CIiF89jEgEsJHnwIiIXz0OSASwntfAiIhvPc1IBLCm4WASAhvlgIiIbxaDIiE8Go5IBLCi5WASAgv1gIiIdxuGwGREG63rYBICJsBkRC2AyIhbAZEQtgOiITMbicgEjK7vYBIyNx2AyIhc%2Ft7%2FwO5%2Fxk9kjDfM74PCZlYTkAkZF5ZAZGQeeUFREJmlRkQCZlVbkAkZE7ZAZGQOeUHREJmVBAQCZlRSUAkZD5FAZGQ%2BZQFREJmUxgQCZlNaUAkZC7FAZGQuZQHREJmciAgEjKTIwGRkHkcCoiEzONYQCRkFgcDIiGzOBoQCZnD4YBIyByOB0RCZnAiIBIygzMBkZDxnQqIhIzvXEAkZHQnAyIhozsbEAkZ2%2BmASMjYzgdEQkZ2QUAkZGRXBERCxnVJQCRkXNcEREJGdVFAJGRUVwVEQsZ0WUAkZEzXBURCRnRhQCRkRFcGRELGc2lAJGQ81wZEQkZzcUAkZDRXB0RCxnJ5QCRkLNcHREJGUiEgEjKSGgGRkHFUCYiEjKNOQCRkFJUC0kdCfo0eMIBU6%2BHfOkjIL9EDHt%2F3f6s9%2FeP3ak%2FnUpDTUr2nO0iIgpxVMSA9JERBzko1H49PiIKcVDUgHSREQU5KdZ8PT4iCnFM5IPEJUZBzUu0D0QlRkFOqByQ8IQpySqp%2FIjghCnJGg4BEJ0RBzkgtjsQmREFOaBKQ4IQoyAmpzZnQhCjIcY0CEpsQBTkutToUmRAFOaxZQEIToiCHpXanAhOiIEc1DEhkQhTkqNTyWFxCFOSgpgEJTIiCHJTangtLiIIc0zggcQlRkGNS64NRCVGQQ5oHJCwhCnJIan8yKCEKckRAQKISoiBHpIijMQlRkANCAhKUEAU5IMWcDUmIgpQLCkhMQhSkXIo6HJEQBSkWFpCQhChIsRR3OiAhClIqMCARCVGQUinyePuEKEih0IAEJERBCqXY880ToiBlggPSPiEKUiZFD2idEAUpEh6Q5glRkCIpekDzhChIiQ4C0johClIiRQ%2B43VonREEKdBGQxglRkAIpesCLpglRkHydBKRtQhQkX4oe8KplQhQkWzcBaZoQBcmWoge8aZgQBcnVUUBaJkRBcqXoAe%2B1S4iCZOoqIA0ToiCZUvSAj5olREHydBaQdglRkDwpesBnrRKiIFm6C0izhChIlhQ94KtGCVGQHB0GpFVCFCRHih6wpE1CFCRDlwFplBAFyZCiByxrkhAF2ddpQNokREH2pegBa1okREF2dRuQJglRkF0pesC6BglRkD0dB6RFQhRkT4oesKV%2BQhRkR9cBaZAQBdmRogdsq54QBdnWeUDqJ0RBtqXoAXtqJ0RBNnUfkOoJUZBNKXrAvsoJUZAtDxCQ2glRkC0pekCOuglRkA0PEZDKCVGQDSl6QJ6qCVGQdQ8SkLoJUZB1KXpArpoJUZBVDxOQqglRkFUpekC%2BiglRkDUPFJCaCVGQNSl6QIl6CVGQFQ8VkIoJUZAVKXpAmWoJUZBlDxaQeglRkGUpekCpWglRkEUPF5CY33IDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALPgPk4kcT0VapOAAAAAASUVORK5CYII%3D%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fmask%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fdefs%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20mask%3D%22url(%23Mask)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22295.382%22%20y%3D%22220.895%22%20width%3D%22179.105%22%20height%3D%22179.105%22%20style%3D%22fill%3Aurl(%23_Linear2)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(1.224174%2C-0%2C0%2C1.233779%2C-2405.801489%2C-194.683874)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M291.598%2C194.088L381.151%2C373.194L202.046%2C373.194L291.598%2C194.088ZM291.598%2C208.623L212.563%2C366.694L370.634%2C366.694L291.598%2C208.623Z%22%20style%3D%22fill%3Awhite%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0.897375%2C0.444731%2C-0.437833%2C0.897375%2C-125.607752%2C874.23332)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(1.373385%2C0%2C0%2C1.384161%2C-2537.909786%2C-110.391113)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22101.141%22%20y%3D%22112.104%22%20width%3D%22159.646%22%20height%3D%22159.646%22%20style%3D%22fill%3Argb(125%2C255%2C0)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M260.788%2C112.104L260.788%2C271.75L101.141%2C271.75L101.141%2C112.104L260.788%2C112.104ZM253.657%2C119.234L108.272%2C119.234L108.272%2C264.619L253.657%2C264.619L253.657%2C119.234Z%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(0.812425%2C0%2C0%2C0.818799%2C-2436.395872%2C-1.883118)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22101.141%22%20y%3D%22112.104%22%20width%3D%22159.646%22%20height%3D%22159.646%22%20style%3D%22fill%3Argb(0%2C255%2C255)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M260.788%2C112.104L260.788%2C271.75L101.141%2C271.75L101.141%2C112.104L260.788%2C112.104ZM248.733%2C124.158L113.196%2C124.158L113.196%2C259.695L248.733%2C259.695L248.733%2C124.158Z%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%3Cdefs%3E%0A%20%20%20%20%20%20%20%20%3ClinearGradient%20id%3D%22_Linear2%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%220%22%20gradientUnits%3D%22userSpaceOnUse%22%20gradientTransform%3D%22matrix(179.105244%2C0%2C0%2C179.105244%2C295.382358%2C310.447378)%22%3E%3Cstop%20offset%3D%220%22%20style%3D%22stop-color%3Ablack%3Bstop-opacity%3A1%22%2F%3E%3Cstop%20offset%3D%221%22%20style%3D%22stop-color%3Ablack%3Bstop-opacity%3A0%22%2F%3E%3C%2FlinearGradient%3E%0A%20%20%20%20%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A", controls: {action: { label: "action", default: "Space" },}, factory: function createGD() {
  const KEYS = Store.bindings.resolve('Geometry Dash');
  if (!document.getElementById('gd-titan-font')) {
    const link = document.createElement('link'); link.id = 'gd-titan-font'; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Titan+One&display=swap'; document.head.appendChild(link);
  }
  const c = document.createElement('canvas'); c.id = 'gd-game-canvas';
  const ctx = c.getContext('2d'); c.width = 400; c.height = 150;
  UI.applyCanvasStyle(c, 400/150, 'Geometry Dash');

  let py = 110, pv = 0, isGround = false, rot = 0;
  let os = 4.5, distance = 0, alive = true;
  let obs = [], frames = 0, nextSpawn = 0;
  let portal = null, nextPortalDist = 50, gX = 0, bgX = 0;
  let currentHue = Math.floor(Math.random() * 360), expStart = 0, particles = []; 
  
  const GD_SQUARES = [[0, 74, 55, 55], [59, 89, 40, 40], [104, 77, 53, 53], [181, 10, 56, 42], [162, 37, 15, 15], [162, 20, 15, 15], [104, 20, 53, 53], [0, 10, 39, 34], [44, 10, 56, 34], [104, 10, 73, 6], [162, 56, 74, 74], [0, 47, 24, 24], [30, 47, 24, 24], [59, 47, 40, 40]];
  const CUBE_PATTERNS = [[{t:'b',x:0,y:110},{t:'s',x:20,y:110},{t:'s',x:40,y:110},{t:'s',x:60,y:110},{t:'b',x:80,y:110},{t:'b',x:80,y:90},{t:'s',x:100,y:110},{t:'s',x:120,y:110},{t:'s',x:140,y:110},{t:'b',x:160,y:110},{t:'b',x:160,y:90},{t:'b',x:160,y:70}],[{t:'s',x:0,y:110}],[{t:'s',x:0,y:110},{t:'s',x:20,y:110}],[{t:'b',x:0,y:110}],[{t:'b',x:0,y:110},{t:'b',x:0,y:90}]];
  const SHIP_PATTERNS = [[{t:'b',x:0,y:10},{t:'b',x:0,y:30},{t:'b',x:0,y:90},{t:'b',x:0,y:110}],[{t:'b',x:0,y:70},{t:'b',x:20,y:70},{t:'s',x:0,y:50},{t:'s',x:20,y:50}],[{t:'b',x:0,y:10},{t:'us',x:0,y:30},{t:'b',x:60,y:110},{t:'s',x:60,y:90}],[{t:'b',x:0,y:50},{t:'b',x:20,y:50},{t:'s',x:0,y:30},{t:'s',x:20,y:30},{t:'us',x:0,y:70},{t:'us',x:20,y:70}]];

  function drawGDText(text, x, y, size, color) {
    ctx.font = size + 'px "Titan One", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000000'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function drawBG() {
    ctx.fillStyle = 'hsl(' + currentHue + ', 50%, 62%)'; ctx.fillRect(0, 10, 400, 120);
    const tileW = 240; const offset = -(Math.floor(bgX) % tileW);
    ctx.fillStyle = 'hsl(' + currentHue + ', 43%, 59%)';
    for (let tileX = offset - tileW; tileX < 400; tileX += tileW) for (const b of GD_SQUARES) ctx.fillRect(tileX + b[0], b[1], b[2], b[3]);
  }
  function spawn() {
    const mode = Math.floor(distance / 50) % 2 === 0 ? 'cube' : 'ship';
    const pool = mode === 'cube' ? CUBE_PATTERNS : SHIP_PATTERNS;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    const large = choice.length > 5;
    choice.forEach(o => obs.push({ t:o.t, x:400+o.x, y:o.y, w:20, h:20 }));
    nextSpawn = (mode === 'cube' ? (large ? 140 : 55) : 90) + Math.random() * 45;
  }
  function dSpike(x, y) {
    const g = ctx.createLinearGradient(x, y, x, y+20); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.moveTo(x, y+20); ctx.lineTo(x+10, y); ctx.lineTo(x+20, y+20); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
  }
  function dUSSpike(x, y) {
    const g = ctx.createLinearGradient(x, y, x, y+20); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+20, y); ctx.lineTo(x+10, y+20); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
  }
  function dBlock(x, y) {
    const g = ctx.createLinearGradient(x, y, x, y+20); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, 20, 20); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
  }
  function drawPortal(x, mode) {
    const c1 = mode === 'ship' ? '#ff00ff' : '#00ff00';
    ctx.save(); ctx.translate(x, 70); 
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(5, 0, 13, 36, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(10, 0, 13, 36, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(15, 0, 13, 36, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowColor = c1; ctx.shadowBlur = 15; ctx.strokeStyle = c1; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 36, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 11, 34, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ccc'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    if (mode === 'cube') { ctx.fillRect(16, -5, 7, 10); ctx.strokeRect(16, -5, 7, 10); } 
    else {
      ctx.beginPath(); ctx.moveTo(23, 0); ctx.lineTo(16, -5); ctx.lineTo(18, 0); ctx.lineTo(16, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const nodes = [{x: 0, y: -46, r: 3.5}, {x: 0, y: 46, r: 3.5}, {x: 27, y: -16, r: 3}, {x: 29, y: 0, r: 4}, {x: 27, y: 16, r: 3}];
    nodes.forEach(n => {
      ctx.shadowColor = c1; ctx.shadowBlur = 8; ctx.fillStyle = c1;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
  function reset() {
    py=110; pv=0; isGround=false; rot=0; os=4.5; distance=0; alive=true;
    obs=[]; frames=0; nextSpawn=0; portal=null; nextPortalDist=50; gX=0; bgX=0;
    currentHue = Math.floor(Math.random() * 360); Hub.keys[KEYS.action] = false; spawn();
  }
  spawn();

  return {
    el: c, onKey() {},
    tick() {
      if (!alive && performance.now() - expStart >= 1000) { reset(); return; }
      const mode = Math.floor(distance / 50) % 2 === 0 ? 'cube' : 'ship';
      if (alive) {
        if (mode === 'cube') {
          if (Hub.keys[KEYS.action] && !isGround) { pv = -7.5; isGround = true; }
          pv += 0.6;
        } else {
          pv += Hub.keys[KEYS.action] ? -0.35 : 0.25;
          if (pv >  4) pv =  4; if (pv < -4) pv = -4;
        }
      }
      let nextY = py + (alive ? pv : 0), floor = 110, col = false;
      if (mode === 'ship') {
        if (nextY < 10)  { nextY = 10;  pv = 0; }
        if (nextY > 110) { nextY = 110; pv = 0; isGround = false; }
      }
      if (alive) {
        for (let i = obs.length-1; i >= 0; i--) {
          const o = obs[i]; o.x -= os;
          if (o.x < -30) { obs.splice(i,1); continue; }
          if (o.t === 'b') {
            const overlapH = 40 < o.x+20 && 60 > o.x;
            const overlapV = nextY < o.y+20 && nextY+20 > o.y;
            if (overlapH && overlapV) {
              const wasAbove = py+20 <= o.y+1; const wasBelow = py    >= o.y+19;   
              if (wasAbove) { floor = o.y - 20; nextY = floor; pv = 0; } 
              else if (wasBelow && mode === 'ship') { nextY = o.y + 20; if (pv < 0) pv = 0; } 
              else col = true;
            }
          } else {
            const sX1 = o.x + 8,  sX2 = o.x + 12, sY1 = o.y + 6,  sY2 = o.y + 14;
            if (40 < sX2 && 60 > sX1 && nextY < sY2 && nextY+20 > sY1) col = true;
          }
        }
      }
      py = nextY;
      if (py >= floor) { py=floor; pv=0; isGround=false; if (mode==='cube') rot=Math.round(rot/90)*90; } else isGround = true;
      if (mode === 'cube') { if (isGround) rot += 6; } else rot = pv * 4;
      if (col) {
        alive = false; Store.scores.submit('Geometry Dash', Math.floor(distance));
        expStart = performance.now(); particles = [];
        for (let i = 0; i < 8; i++) particles.push({ x: 50, y: py + 10, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, r: 2 + Math.random() * 3 });
      }
      if (alive) {
        gX += os; bgX += os * 0.5; 
        if (!portal && nextPortalDist - distance < 3.89 && nextPortalDist - distance > 0) portal = { x: 400, mode: (Math.floor(nextPortalDist / 50) % 2 === 0) ? 'cube' : 'ship' };
        if (portal) { portal.x -= os; if (portal.x < -30) portal = null; }
        if (distance >= nextPortalDist) { nextPortalDist += 50; currentHue = Math.floor(Math.random() * 360); }
        const distToNextSwitch = nextPortalDist - distance; frames++;
        if (distToNextSwitch <= 10) frames = 0; else if (frames >= nextSpawn) { spawn(); frames = 0; }
        distance += 0.05;
      }
      drawBG();
      ctx.fillStyle = 'hsl(' + currentHue + ', 48%, 45%)'; ctx.fillRect(0, 130, 400, 20); ctx.fillRect(0, 0, 400, 10);   
      ctx.fillStyle = 'hsl(' + currentHue + ', 38%, 54%)'; ctx.fillRect(0, 130, 400, 3); ctx.fillRect(0, 7, 400, 3);   
      const streakOffset = Math.floor(gX % 60);
      for (let x = -streakOffset; x < 400; x += 60) { ctx.fillRect(x, 130, 3, 20); ctx.fillRect(x, 0, 3, 10); }
      if (alive) {
        ctx.save(); ctx.translate(50, py+10); ctx.rotate(rot * Math.PI / 180);
        if (mode === 'cube') {
          ctx.fillStyle='#7dff00'; ctx.fillRect(-10,-10,20,20);
          ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.strokeRect(-10,-10,20,20);
          ctx.fillStyle='#00ffff'; ctx.fillRect(-5,-5,10,10);
          ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.strokeRect(-5,-5,10,10);
        } else {
          ctx.fillStyle='#00ffaa'; ctx.beginPath(); ctx.moveTo(-12,4); ctx.lineTo(12,4); ctx.lineTo(6,-6); ctx.lineTo(-6,-6); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
          ctx.fillStyle='#ff5500'; ctx.fillRect(-15,-2,4,5);
          ctx.fillStyle='#00ffff'; ctx.beginPath(); ctx.moveTo(2,-2); ctx.lineTo(8,-2); ctx.lineTo(5,-5); ctx.lineTo(1,-5); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='#000'; ctx.stroke();
          ctx.fillStyle='#00aa77'; ctx.beginPath(); ctx.moveTo(-8,4); ctx.lineTo(-2,9); ctx.lineTo(4,4); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      } else {
        const p = Math.min((performance.now() - expStart) / 1000, 1);
        ctx.fillStyle = 'rgba(125, 255, 0, ' + (1 - p) + ')'; ctx.beginPath(); ctx.arc(50, py + 10, p * 25, 0, Math.PI * 2); ctx.fill(); 
        particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2; ctx.fillStyle = 'rgba(125, 255, 0, ' + (1 - p) + ')'; ctx.fillRect(pt.x, pt.y, pt.r, pt.r); });
      }
      obs.forEach(o => { if (o.t==='b') dBlock(o.x,o.y); else if (o.t==='s') dSpike(o.x,o.y); else if (o.t==='us') dUSSpike(o.x,o.y); });
      if (portal) drawPortal(portal.x, portal.mode);
      if (Hub._debug) {
        ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffff00'; ctx.strokeRect(40, py, 20, 20);
        obs.forEach(o => { if (o.t === 'b') { ctx.strokeStyle = '#4488ff'; ctx.strokeRect(o.x, o.y, 20, 20); } else { ctx.strokeStyle = '#ff3333'; ctx.strokeRect(o.x + 8, o.y + 6, 4, 8); } }); ctx.restore();
      }
      drawGDText('Distance:' + Math.floor(distance), 15,  12, 14, '#ffffff');
      drawGDText('Best:'     + Store.scores.get('Geometry Dash'), 292, 12, 14, '#ffffff');
    },
    destroy() { c.remove(); }
  };
} },{ name: "Space Invaders", icon: "data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%3Cg%20fill%3D%22%230f0%22%3E%0A%20%20%20%20%3C!--%20Row%200%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2232%22%20y%3D%2226%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2262%22%20y%3D%2226%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3C!--%20Row%201%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2238%22%20y%3D%2232%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256%22%20y%3D%2232%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3C!--%20Row%202%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2232%22%20y%3D%2238%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2238%22%20y%3D%2238%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2244%22%20y%3D%2238%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2250%22%20y%3D%2238%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256%22%20y%3D%2238%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2262%22%20y%3D%2238%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3C!--%20Row%203%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2226%22%20y%3D%2244%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232%22%20y%3D%2244%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2244%22%20y%3D%2244%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2250%22%20y%3D%2244%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2262%22%20y%3D%2244%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2268%22%20y%3D%2244%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3C!--%20Row%204%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2220%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2226%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2238%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2244%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2250%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2262%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2268%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2274%22%20y%3D%2250%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3C!--%20Row%205%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2220%22%20y%3D%2256%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232%22%20y%3D%2256%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2238%22%20y%3D%2256%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2244%22%20y%3D%2256%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2250%22%20y%3D%2256%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256%22%20y%3D%2256%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2262%22%20y%3D%2256%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2274%22%20y%3D%2256%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3C!--%20Row%206%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2220%22%20y%3D%2262%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232%22%20y%3D%2262%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2262%22%20y%3D%2262%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2274%22%20y%3D%2262%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3C!--%20Row%207%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2238%22%20y%3D%2268%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2244%22%20y%3D%2268%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2250%22%20y%3D%2268%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256%22%20y%3D%2268%22%20width%3D%226%22%20height%3D%226%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E", controls: {left: { label: "Move Left", default: "KeyA" },right: { label: "Move Right", default: "KeyD" },shoot: { label: "Shoot", default: "Space" },restart: { label: "Restart", default: "KeyR" },}, factory: function createInvaders() {
  const KEYS = Store.bindings.resolve('Space Invaders');
  const c = document.createElement('canvas'); c.id = 'g';
  const ctx = c.getContext('2d'); c.width = 300; c.height = 250;
  UI.applyCanvasStyle(c, 300/250, 'Space Invaders');
  let score=0, over=false, lives=3, player={x:142,y:220,w:15,h:15};
  let bullets=[], bombs=[], aliens=[], ufo=null;
  let alienDir=1, alienStepTimer=0, alienStepDelay=60, bombCooldown=0;
  let stars = Array.from({length:20}, () => ({ x:Math.random()*300, y:Math.random()*250, v:0.3+Math.random() }));
  let bunkers = [];

  function initBunkers() {
    bunkers = [];
    for(let i=0; i<3; i++) {
      let bx = 35 + i * 95, by = 190;
      for(let r=0; r<4; r++) for(let cc=0; cc<10; cc++) if(!(r >= 2 && cc >= 4 && cc <= 5)) bunkers.push({x: bx + cc*4, y: by + r*4, w:4, h:4});
    }
  }
  function reset() {
    score=0; over=false; lives=3; bullets.length=0; bombs.length=0; aliens.length=0; ufo=null;
    player.x=142; player.y=220; alienDir=1; alienStepTimer=0; alienStepDelay=60; bombCooldown=0;
    for(let r=0; r<4; r++) for(let c=0; c<7; c++) aliens.push({x: 40 + c*30, y: 30 + r*20, alive: true, w: 15, h: 11});
    initBunkers();
  }
  reset();

  return {
    el: c,
    onKey(code) {
      if (code===KEYS.shoot && !over && bullets.length < 1) bullets.push({x:player.x+6,y:player.y,w:3,h:8});
      if (code===KEYS.restart && over) reset();
    },
    tick() {
      const K = Hub.keys;
      ctx.clearRect(0,0,300,250);
      ctx.fillStyle='#fff'; stars.forEach(s => { s.y+=s.v; if(s.y>250)s.y=0; ctx.fillRect(s.x,s.y,1,1); });
      if (!over) {
        if (K[KEYS.left] && player.x>0) player.x-=3;
        if (K[KEYS.right] && player.x<285) player.x+=3;
        for (let i=bullets.length-1;i>=0;i--) { bullets[i].y-=5; if(bullets[i].y<0)bullets.splice(i,1); }
        for (let i=bombs.length-1;i>=0;i--) { bombs[i].y+=3; if(bombs[i].y>250) bombs.splice(i,1); }
        let aliveCount = aliens.filter(a => a.alive).length;
        alienStepDelay = Math.max(10, 60 - (28 - aliveCount) * 2); alienStepTimer++;
        if (alienStepTimer >= alienStepDelay) {
          alienStepTimer = 0; let hitEdge = false;
          aliens.forEach(a => { if(a.alive) { a.x += 5 * alienDir; if (a.x < 0 || a.x + a.w > 300) hitEdge = true; } });
          if (hitEdge) { alienDir *= -1; aliens.forEach(a => { if(a.alive) { a.x += 5 * alienDir; a.y += 10; } }); }
        }
        if (bombCooldown > 0) bombCooldown--;
        if (bombCooldown <= 0) {
          let bottomAliens = [];
          for(let c=0; c<7; c++) { let lowest = null; for(let r=3; r>=0; r--) { let a = aliens[r*7 + c]; if(a && a.alive) { lowest = a; break; } } if(lowest) bottomAliens.push(lowest); }
          if(bottomAliens.length > 0) {
            let shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)];
            bombs.push({x: shooter.x + 6, y: shooter.y + shooter.h, w: 3, h: 8});
            let baseCD = Math.max(45, 120 - (28 - aliveCount) * 2.5); bombCooldown = baseCD + Math.floor(Math.random() * 90);
          }
        }
        if (!ufo && Math.random() < 0.002) { ufo = { x: -20, y: 10, w: 20, h: 8, dir: 1 }; if (Math.random() < 0.5) { ufo.x = 300; ufo.dir = -1; } }
        if (ufo) { ufo.x += 2 * ufo.dir; if (ufo.x < -20 || ufo.x > 300) ufo = null; }
        for (let i=bullets.length-1;i>=0;i--) {
          const b=bullets[i];
          if (ufo && b.x<ufo.x+ufo.w && b.x+b.w>ufo.x && b.y<ufo.y+ufo.h && b.y+b.h>ufo.y) { ufo = null; bullets.splice(i,1); score += 100; continue; }
          for (let j=aliens.length-1;j>=0;j--) { const a=aliens[j]; if (a.alive && b.x<a.x+a.w && b.x+b.w>a.x && b.y<a.y+a.h && b.y+b.h>a.y) { a.alive = false; bullets.splice(i,1); score+=10; break; } }
        }
        function checkBunkerCollision(arr) { for (let i=arr.length-1;i>=0;i--) { const p = arr[i]; for (let j=bunkers.length-1;j>=0;j--) { const bk = bunkers[j]; if (p.x<bk.x+bk.w && p.x+p.w>bk.x && p.y<bk.y+bk.h && p.y+p.h>bk.y) { bunkers.splice(j,1); arr.splice(i,1); break; } } } }
        checkBunkerCollision(bullets); checkBunkerCollision(bombs);
        for (let i=bombs.length-1;i>=0;i--) {
          const b = bombs[i];
          if (b.x<player.x+player.w && b.x+b.w>player.x && b.y<player.y+player.h && b.y+b.h>player.y) {
            bombs.splice(i,1); lives--;
            if (lives <= 0) { Store.scores.submit('Space Invaders', score); over = true; } else player.x = 142; 
          }
        }
        for (let a of aliens) if (a.alive && a.y + a.h >= 230) { lives = 0; Store.scores.submit('Space Invaders', score); over = true; break; }
        if (aliens.every(a => !a.alive)) { for(let r=0; r<4; r++) for(let c=0; c<7; c++) { aliens[r*7 + c].alive = true; aliens[r*7 + c].x = 40 + c*30; aliens[r*7 + c].y = 30 + r*20; } alienDir = 1; alienStepDelay = 60; }
      }
      aliens.forEach(a => { if (a.alive) { ctx.fillStyle='#0f0'; Utils.drawPixels(ctx, a.x, a.y, 1.3, [[0,0,1,0,0,0,0,1,0,0],[0,0,0,1,0,0,1,0,0,0],[0,0,1,1,1,1,1,1,0,0],[0,1,1,0,1,1,0,1,1,0],[1,1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1,0,1],[1,0,1,0,0,0,0,1,0,1],[0,0,0,1,1,1,1,0,0,0]]); } });
      ctx.fillStyle = '#0ff'; bunkers.forEach(bk => ctx.fillRect(bk.x, bk.y, bk.w, bk.h));
      if (ufo) { ctx.fillStyle = '#f00'; Utils.drawPixels(ctx, ufo.x, ufo.y, 2, [[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,0,1,1,0,1,1],[1,1,1,1,1,1,1,1],[0,1,0,0,0,0,1,0]]); }
      if (!over || lives > 0) { ctx.fillStyle='#fff'; Utils.drawPixels(ctx, player.x, player.y, 1.25, [[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,0,1,0,1,1],[1,1,1,1,1,1,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1]]); }
      ctx.fillStyle='#ff0'; bullets.forEach(b => ctx.fillRect(b.x,b.y,b.w,b.h));
      ctx.fillStyle='#f33'; bombs.forEach(b => ctx.fillRect(b.x,b.y,b.w,b.h));
      ctx.fillStyle='#fff'; ctx.font='10px sans-serif'; ctx.textAlign='left'; ctx.fillText('Score: '+score, 10, 15);
      ctx.fillStyle='#aaa'; ctx.fillText('Best: '+Store.scores.get('Space Invaders'), 10, 30);
      ctx.textAlign='right'; ctx.fillStyle='#f00';
      for(let i=0; i<lives; i++) Utils.drawPixels(ctx, 290 - i*20, 10, 1, [[0,0,1,0,0,0,0],[0,1,1,1,0,0,0],[1,1,1,1,1,0,0],[1,0,1,0,1,0,0]]);
      ctx.textAlign='left';
      if (over) {
        ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,300,250);
        ctx.fillStyle='#fff'; ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.fillText('GAME OVER',150,110);
        ctx.font='10px sans-serif'; ctx.fillText('Press '+Utils.prettyKey(KEYS.restart)+' to Restart', 150, 135);
        ctx.fillStyle='#aaa'; ctx.fillText('Best: '+Store.scores.get('Space Invaders'),150,155); ctx.textAlign='left';
      }
    },
    destroy() { c.remove(); }
  };
} },{ name: "Block Blast", icon: "data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22350%22%20height%3D%22350%22%20viewBox%3D%220%200%20350%20350%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22bg%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22rgb(12%2C16%2C38)%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22rgb(24%2C29%2C58)%22%2F%3E%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22glossGrad%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22rgba(255%2C255%2C255%2C0.5)%22%2F%3E%3Cstop%20offset%3D%220.25%22%20stop-color%3D%22rgba(255%2C255%2C255%2C0.1)%22%2F%3E%3Cstop%20offset%3D%220.85%22%20stop-color%3D%22rgba(0%2C0%2C0%2C0.0)%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22rgba(0%2C0%2C0%2C0.35)%22%2F%3E%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22glossHigh%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22rgba(255%2C255%2C255%2C0.85)%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22rgba(255%2C255%2C255%2C0.05)%22%2F%3E%3C%2FlinearGradient%3E%0A%20%20%20%20%3Cfilter%20id%3D%22blockShadow%22%20x%3D%22-20%25%22%20y%3D%22-20%25%22%20width%3D%22140%25%22%20height%3D%22140%25%22%3E%3CfeDropShadow%20dx%3D%220%22%20dy%3D%222%22%20stdDeviation%3D%221.5%22%20flood-color%3D%22rgba(0%2C0%2C0%2C0.3)%22%2F%3E%3C%2Ffilter%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22350%22%20height%3D%22350%22%20fill%3D%22url(%23bg)%22%2F%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C204%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232.3%22%20y%3D%2246.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229.5%22%20y%3D%2245.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C204%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256.3%22%20y%3D%2246.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253.5%22%20y%3D%2245.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(90%2C200%2C250)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2280.3%22%20y%3D%2246.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277.5%22%20y%3D%2245.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(0%2C122%2C255)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22104.3%22%20y%3D%2246.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101.5%22%20y%3D%2245.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(0%2C122%2C255)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22128.3%22%20y%3D%2246.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125.5%22%20y%3D%2245.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Crect%20x%3D%22149%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20171%2060.84%20A%206.16%206.16%200%200%201%20164.84%2067%20L%20155.16%2067%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(52%2C199%2C89)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22176.3%22%20y%3D%2246.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173.5%22%20y%3D%2245.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C59%2C48)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%2245%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22200.3%22%20y%3D%2246.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197.5%22%20y%3D%2245.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C204%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232.3%22%20y%3D%2270.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229.5%22%20y%3D%2269.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C204%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256.3%22%20y%3D%2270.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253.5%22%20y%3D%2269.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(90%2C200%2C250)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2280.3%22%20y%3D%2270.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277.5%22%20y%3D%2269.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Crect%20x%3D%22101%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20123%2084.84%20A%206.16%206.16%200%200%201%20116.84%2091%20L%20107.16%2091%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(52%2C199%2C89)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22128.3%22%20y%3D%2270.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125.5%22%20y%3D%2269.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C59%2C48)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22152.3%22%20y%3D%2270.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149.5%22%20y%3D%2269.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C59%2C48)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22176.3%22%20y%3D%2270.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173.5%22%20y%3D%2269.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C59%2C48)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%2269%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22200.3%22%20y%3D%2270.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197.5%22%20y%3D%2269.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(175%2C82%2C222)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232.3%22%20y%3D%2294.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229.5%22%20y%3D%2293.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(90%2C200%2C250)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256.3%22%20y%3D%2294.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253.5%22%20y%3D%2293.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(90%2C200%2C250)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2280.3%22%20y%3D%2294.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277.5%22%20y%3D%2293.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(52%2C199%2C89)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22104.3%22%20y%3D%2294.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101.5%22%20y%3D%2293.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Crect%20x%3D%22125%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20147%20108.84%20A%206.16%206.16%200%200%201%20140.84%20115%20L%20131.16%20115%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Crect%20x%3D%22149%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20171%20108.84%20A%206.16%206.16%200%200%201%20164.84%20115%20L%20155.16%20115%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Crect%20x%3D%22173%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20195%20108.84%20A%206.16%206.16%200%200%201%20188.84%20115%20L%20179.16%20115%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C149%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%2293%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22200.3%22%20y%3D%2294.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197.5%22%20y%3D%2293.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(175%2C82%2C222)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232.3%22%20y%3D%22118.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229.5%22%20y%3D%22117.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(175%2C82%2C222)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256.3%22%20y%3D%22118.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253.5%22%20y%3D%22117.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(0%2C122%2C255)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2280.3%22%20y%3D%22118.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277.5%22%20y%3D%22117.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(0%2C122%2C255)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22104.3%22%20y%3D%22118.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101.5%22%20y%3D%22117.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(90%2C200%2C250)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22128.3%22%20y%3D%22118.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125.5%22%20y%3D%22117.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(0%2C122%2C255)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22152.3%22%20y%3D%22118.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149.5%22%20y%3D%22117.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(52%2C199%2C89)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22176.3%22%20y%3D%22118.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173.5%22%20y%3D%22117.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C149%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22117%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22200.3%22%20y%3D%22118.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197.5%22%20y%3D%22117.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(175%2C82%2C222)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232.3%22%20y%3D%22142.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229.5%22%20y%3D%22141.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C149%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256.3%22%20y%3D%22142.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253.5%22%20y%3D%22141.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Crect%20x%3D%2277%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%2099%20156.84%20A%206.16%206.16%200%200%201%2092.84%20163%20L%2083.16%20163%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Crect%20x%3D%22101%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20123%20156.84%20A%206.16%206.16%200%200%201%20116.84%20163%20L%20107.16%20163%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(90%2C200%2C250)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22128.3%22%20y%3D%22142.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125.5%22%20y%3D%22141.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(0%2C122%2C255)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22152.3%22%20y%3D%22142.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149.5%22%20y%3D%22141.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Crect%20x%3D%22173%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20195%20156.84%20A%206.16%206.16%200%200%201%20188.84%20163%20L%20179.16%20163%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C149%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22141%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22200.3%22%20y%3D%22142.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197.5%22%20y%3D%22141.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C59%2C48)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232.3%22%20y%3D%22166.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229.5%22%20y%3D%22165.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C149%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256.3%22%20y%3D%22166.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253.5%22%20y%3D%22165.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(52%2C199%2C89)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2280.3%22%20y%3D%22166.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277.5%22%20y%3D%22165.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(90%2C200%2C250)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22104.3%22%20y%3D%22166.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101.5%22%20y%3D%22165.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(90%2C200%2C250)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22128.3%22%20y%3D%22166.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125.5%22%20y%3D%22165.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(52%2C199%2C89)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22152.3%22%20y%3D%22166.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149.5%22%20y%3D%22165.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Crect%20x%3D%22173%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20195%20180.84%20A%206.16%206.16%200%200%201%20188.84%20187%20L%20179.16%20187%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(175%2C82%2C222)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22165%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22200.3%22%20y%3D%22166.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197.5%22%20y%3D%22165.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C59%2C48)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232.3%22%20y%3D%22190.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229.5%22%20y%3D%22189.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C149%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256.3%22%20y%3D%22190.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253.5%22%20y%3D%22189.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(0%2C122%2C255)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2280.3%22%20y%3D%22190.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277.5%22%20y%3D%22189.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Crect%20x%3D%22101%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(9%2C13%2C34)%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%221.5%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M%20123%20204.84%20A%206.16%206.16%200%200%201%20116.84%20211%20L%20107.16%20211%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C204%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22128.3%22%20y%3D%22190.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125.5%22%20y%3D%22189.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C204%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22152.3%22%20y%3D%22190.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149.5%22%20y%3D%22189.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(175%2C82%2C222)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22176.3%22%20y%3D%22190.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173.5%22%20y%3D%22189.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(175%2C82%2C222)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22189%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22200.3%22%20y%3D%22190.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197.5%22%20y%3D%22189.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C59%2C48)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2232.3%22%20y%3D%22214.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2229.5%22%20y%3D%22213.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C59%2C48)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2256.3%22%20y%3D%22214.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2253.5%22%20y%3D%22213.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(0%2C122%2C255)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2280.3%22%20y%3D%22214.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2277.5%22%20y%3D%22213.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(52%2C199%2C89)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22104.3%22%20y%3D%22214.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22101.5%22%20y%3D%22213.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C204%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22128.3%22%20y%3D%22214.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22125.5%22%20y%3D%22213.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(255%2C204%2C0)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22152.3%22%20y%3D%22214.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22149.5%22%20y%3D%22213.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(52%2C199%2C89)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22176.3%22%20y%3D%22214.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22173.5%22%20y%3D%22213.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22rgb(175%2C82%2C222)%22%20filter%3D%22url(%23blockShadow)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197%22%20y%3D%22213%22%20width%3D%2222%22%20height%3D%2222%22%20rx%3D%226.16%22%20fill%3D%22url(%23glossGrad)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22200.3%22%20y%3D%22214.76%22%20width%3D%229.24%22%20height%3D%225.5%22%20rx%3D%221.76%22%20fill%3D%22url(%23glossHigh)%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22197.5%22%20y%3D%22213.5%22%20width%3D%2221%22%20height%3D%2221%22%20rx%3D%226.16%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.25)%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E", controls: {restart: { label: "Restart", default: "KeyR" },}, factory: function createBlockBlast() {
  const KEYS = Store.bindings.resolve('Block Blast');
  const c = document.createElement('canvas'); c.id = 'blockblast-canvas';
  const ctx = c.getContext('2d'); c.width = 350; c.height = 350;
  UI.applyCanvasStyle(c, 350/350, 'Block Blast');
  c.style.touchAction = 'none';
  const GRID_SIZE = 8, CELL_W = 24, GRID_X = 29, GRID_Y = 45;
  const COLORS = ['white', 'rgb(52,199,89)', 'rgb(0,122,255)', 'rgb(255,149,0)', 'rgb(255,204,0)', 'rgb(175,82,222)', 'rgb(255,59,48)', 'rgb(90,200,250)'];
  const PIECE_TEMPLATES = [{m:[[1]],c:1,pts:1},{m:[[1,1]],c:2,pts:2},{m:[[1],[1]],c:2,pts:2},{m:[[1,1,1]],c:3,pts:3},{m:[[1],[1],[1]],c:3,pts:3},{m:[[1,1],[1,1]],c:4,pts:4},{m:[[1,1,1],[0,1,0]],c:5,pts:4},{m:[[0,1,0],[1,1,1]],c:5,pts:4},{m:[[1,0],[1,0],[1,1]],c:6,pts:4},{m:[[1,1],[0,1],[0,1]],c:6,pts:4},{m:[[0,1],[0,1],[1,1]],c:7,pts:4},{m:[[1,1],[1,0],[1,0]],c:7,pts:4}];
  let board, score, combo, isGameOver, pieces, particles;
  let drag = { isDragging:false, index:-1, currentX:0, currentY:0 };

  function initGame() {
    board = []; for (let r = 0; r < GRID_SIZE; r++) board[r] = Array(GRID_SIZE).fill(0);
    score = 0; combo = 0; isGameOver = false; drag.isDragging = false; drag.index = -1; particles = []; generateNewPieces();
  }
  function rotateMatrix(m) { const rows = m.length, cols = m[0].length; const out = Array.from({length: cols}, () => Array(rows).fill(0)); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[c][rows-1-r] = m[r][c]; return out; }
  function generateNewPieces() {
    pieces = []; const pW = 90, gap = 12, startOff = 22;
    for (let i = 0; i < 3; i++) {
      const t = PIECE_TEMPLATES[Math.floor(Math.random() * PIECE_TEMPLATES.length)]; let mat = JSON.parse(JSON.stringify(t.m));
      const rots = Math.floor(Math.random() * 4); for (let r = 0; r < rots; r++) mat = rotateMatrix(mat);
      const homeX = startOff + i * (pW + gap), homeY = 245;
      pieces.push({ matrix:mat, colorIdx:t.c, squaresCount:t.pts, used:false, homeX, homeY, x: homeX + (90 - mat[0].length * 14) / 2, y: homeY + (90 - mat.length    * 14) / 2, s: 14 });
    }
  }
  function canPlace(matrix, startR, startC) { for (let r = 0; r < matrix.length; r++) for (let cc = 0; cc < matrix[r].length; cc++) if (matrix[r][cc]) { const br = startR+r, bc = startC+cc; if (br>=GRID_SIZE||bc>=GRID_SIZE||br<0||bc<0||board[br][bc]!==0) return false; } return true; }
  function checkGameOver() { for (let pIdx = 0; pIdx < pieces.length; pIdx++) { if (pieces[pIdx].used) continue; for (let r = 0; r < GRID_SIZE; r++) for (let cc = 0; cc < GRID_SIZE; cc++) if (canPlace(pieces[pIdx].matrix, r, cc)) return; } isGameOver = true; Store.scores.submit('Block Blast', score); }
  function spawnPop(x, y, color, delay) { particles.push({ type:'spawner', x, y, c:color, delay:delay||0, timer:0 }); }
  function clearLines(centerR, centerC) {
    const rowsToClear = [], colsToClear = [];
    for (let r = 0; r < GRID_SIZE; r++) if (board[r].every(v => v !== 0)) rowsToClear.push(r);
    for (let cc = 0; cc < GRID_SIZE; cc++) if ([...Array(GRID_SIZE)].every((_,r) => board[r][cc] !== 0)) colsToClear.push(cc);
    rowsToClear.forEach(r => { for (let cc = 0; cc < GRID_SIZE; cc++) { if (board[r][cc] !== 0) { const dist = Math.sqrt((r-centerR)**2 + (cc-centerC)**2); spawnPop(GRID_X+cc*CELL_W, GRID_Y+r*CELL_W, COLORS[board[r][cc]], Math.round(dist*12)); board[r][cc] = 0; } } });
    colsToClear.forEach(cc => { for (let r = 0; r < GRID_SIZE; r++) { if (board[r][cc] !== 0) { const dist = Math.sqrt((r-centerR)**2 + (cc-centerC)**2); spawnPop(GRID_X+cc*CELL_W, GRID_Y+r*CELL_W, COLORS[board[r][cc]], Math.round(dist*12)); board[r][cc] = 0; } } });
    const totalLines = rowsToClear.length + colsToClear.length;
    if (totalLines > 0) { combo++; let pts = totalLines * 10; if (totalLines === 2) pts = 30; if (totalLines === 3) pts = 60; if (totalLines >= 4)  pts = 100; score += pts * combo; } else combo = 0;
  }
  function draw3DBlock(x, y, size, color, isEmpty) {
    const r = size * 0.28; ctx.save();
    if (isEmpty) {
      ctx.fillStyle = 'rgb(9,13,34)'; ctx.beginPath(); ctx.roundRect(x,y,size,size,r); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x+size-r, y+size-r, r, 0, Math.PI*0.5); ctx.lineTo(x+r, y+size); ctx.stroke();
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2; ctx.beginPath(); ctx.roundRect(x,y,size,size,r); ctx.fillStyle = color; ctx.fill();
      ctx.shadowColor = 'transparent'; let grad = ctx.createLinearGradient(x,y,x,y+size); grad.addColorStop(0,    'rgba(255,255,255,0.5)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.1)'); grad.addColorStop(0.85, 'rgba(0,0,0,0.0)'); grad.addColorStop(1,    'rgba(0,0,0,0.35)'); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.roundRect(x+size*0.15, y+size*0.08, size*0.42, size*0.25, size*0.08); let gloss = ctx.createLinearGradient(x, y+size*0.08, x, y+size*0.33); gloss.addColorStop(0, 'rgba(255,255,255,0.85)'); gloss.addColorStop(1, 'rgba(255,255,255,0.05)'); ctx.fillStyle = gloss; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x+0.5, y+0.5, size-1, size-1, r); ctx.stroke();
    }
    ctx.restore();
  }
  function updatePhysics() {
    pieces.forEach((p, i) => {
      if (p.used) return; const mcols = p.matrix[0].length, mrows = p.matrix.length; let targetX, targetY, targetS;
      if (drag.isDragging && drag.index === i) {
        targetS = 22; const rawX  = drag.currentX - (mcols * targetS) / 2; const rawY  = drag.currentY - (mrows * targetS) / 2;
        const snapC = Math.round((rawX - GRID_X) / CELL_W); const snapR = Math.round((rawY - GRID_Y) / CELL_W);
        if (canPlace(p.matrix, snapR, snapC)) { targetX = GRID_X + snapC*CELL_W + 1; targetY = GRID_Y + snapR*CELL_W + 1; } else { targetX = rawX; targetY = rawY; }
      } else { targetS = 14; targetX = p.homeX + (90 - mcols*targetS) / 2; targetY = p.homeY + (90 - mrows*targetS) / 2; }
      for (let step = 0; step < 3; step++) { p.x += (targetX - p.x) * 0.35; p.y += (targetY - p.y) * 0.35; p.s += (targetS - p.s) * 0.35; }
    });
  }
  function updateParticles() {
    for (let i = particles.length-1; i >= 0; i--) {
      const p = particles[i];
      if (p.type === 'spawner') {
        if (p.timer >= p.delay) { for (let j = 0; j < 12; j++) { const ang = Math.random() * Math.PI * 2; const spd = 1.5 + Math.random() * 3.5; particles.push({ x:p.x+CELL_W/2, y:p.y+CELL_W/2, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd-1, r:3+Math.random()*3, c:p.c, a:1, fric:0.98, grav:0.15 }); } particles.splice(i, 1); } else p.timer++;
      } else { p.x += p.vx; p.y += p.vy; p.vx *= p.fric; p.vy *= p.fric; p.vy += p.grav; p.a -= 0.03; if (p.a <= 0) particles.splice(i, 1); }
    }
  }
  function draw() {
    ctx.clearRect(0, 0, 350, 350);
    let bgGrad = ctx.createLinearGradient(0, 0, 0, 350); bgGrad.addColorStop(0, 'rgb(12,16,38)'); bgGrad.addColorStop(1, 'rgb(24,29,58)'); ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, 350, 350);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('SCORE', 29, 18);
    ctx.fillStyle = 'white'; ctx.font = 'bold 24px system-ui'; ctx.fillText(score, 29, 40);
    const best = Store.scores.get('Block Blast'); if (best) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = 'bold 11px system-ui'; ctx.fillText('BEST  ' + best, 105, 40); }
    if (combo > 1) { ctx.fillStyle = 'rgb(255,204,0)'; ctx.font = 'italic bold 13px system-ui'; ctx.fillText('COMBO x' + combo + '!', 200, 38); }
    for (let r = 0; r < GRID_SIZE; r++) for (let cc = 0; cc < GRID_SIZE; cc++) { const bx=GRID_X+cc*CELL_W, by=GRID_Y+r*CELL_W, bs=CELL_W-2; board[r][cc] === 0 ? draw3DBlock(bx, by, bs, null, true) : draw3DBlock(bx, by, bs, COLORS[board[r][cc]], false); }
    particles.forEach(p => { if (p.type === 'spawner') draw3DBlock(p.x, p.y, CELL_W-2, p.c, false); });
    for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.beginPath(); ctx.roundRect(pieces[i].homeX, pieces[i].homeY, 90, 90, 8); ctx.fill(); }
    const order = [0,1,2].filter(i => i !== drag.index).concat(drag.index === -1 ? [] : [drag.index]);
    for (const i of order) {
      const p = pieces[i]; if (p.used) continue; ctx.save();
      if (drag.isDragging && drag.index === i) { ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=12; ctx.shadowOffsetY=10; }
      for (let r = 0; r < p.matrix.length; r++) for (let cc = 0; cc < p.matrix[r].length; cc++) if (p.matrix[r][cc]) draw3DBlock(p.x+cc*p.s, p.y+r*p.s, p.s-1, COLORS[p.colorIdx], false);
      ctx.restore();
    }
    particles.forEach(p => { if (p.type === 'spawner') return; ctx.save(); ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(p.x-p.r*0.3, p.y-p.r*0.3, p.r*0.3, 0, Math.PI*2); ctx.fill(); ctx.restore(); });
    if (isGameOver) {
      ctx.fillStyle = 'rgba(6,9,22,0.92)'; ctx.fillRect(0, 0, 350, 350);
      ctx.fillStyle = 'rgb(255,59,48)'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('OUT OF MOVES', 175, 145);
      ctx.fillStyle = 'white'; ctx.font = 'bold 14px system-ui'; ctx.fillText('Final Score: ' + score, 175, 178);
      ctx.font = '11px system-ui'; ctx.fillStyle = 'rgb(142,142,147)'; ctx.fillText('Click or press ' + Utils.prettyKey(KEYS.restart) + ' to play again', 175, 208);
      if (best) { ctx.fillStyle = 'rgb(255,204,0)'; ctx.fillText('Best: ' + best, 175, 230); } ctx.textAlign = 'left';
    }
  }
  function getPos(e) { const rect = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; const scaleX = c.width / rect.width; const scaleY = c.height / rect.height; return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }; }
  const onDown = e => { if (isGameOver) { initGame(); return; } const m = getPos(e); for (let i = 0; i < 3; i++) { const p = pieces[i]; if (p.used) continue; if (m.x>=p.homeX && m.x<=p.homeX+90 && m.y>=p.homeY && m.y<=p.homeY+90) { drag.isDragging=true; drag.index=i; drag.currentX=m.x; drag.currentY=m.y; c.style.cursor = 'grabbing'; if (e.cancelable) e.preventDefault(); break; } } };
  const onMove = e => { if (!drag.isDragging) return; if (e.cancelable) e.preventDefault(); const m = getPos(e); drag.currentX = m.x; drag.currentY = m.y; };
  const onUp = () => {
    if (!drag.isDragging) return; const p = pieces[drag.index]; const targetS = 22;
    const rawX  = drag.currentX - (p.matrix[0].length * targetS) / 2; const rawY  = drag.currentY - (p.matrix.length    * targetS) / 2;
    const snapC = Math.round((rawX - GRID_X) / CELL_W); const snapR = Math.round((rawY - GRID_Y) / CELL_W);
    if (canPlace(p.matrix, snapR, snapC)) {
      for (let r = 0; r < p.matrix.length; r++) for (let cc = 0; cc < p.matrix[r].length; cc++) if (p.matrix[r][cc]) board[snapR+r][snapC+cc] = p.colorIdx;
      p.used = true; score += p.squaresCount; clearLines(snapR + (p.matrix.length-1)/2, snapC + (p.matrix[0].length-1)/2);
      if (pieces.every(p => p.used)) generateNewPieces(); checkGameOver();
    }
    drag.isDragging=false; drag.index=-1; c.style.cursor='default';
  };
  c.addEventListener('mousedown',  onDown); c.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove); window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup',   onUp); window.addEventListener('touchend',  onUp);
  initGame();

  return {
    el: c,
    onKey(code) { if (code === KEYS.restart && isGameOver) initGame(); },
    tick() { updatePhysics(); updateParticles(); draw(); },
    destroy() {
      c.removeEventListener('mousedown',  onDown); c.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup',   onUp); window.removeEventListener('touchend',  onUp);
      c.remove();
    }
  };
} },{ name: "Flappy Bird", icon: "data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%20%20%3C!--%20Background%20%26%20Ground%20--%3E%0A%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22100%22%20height%3D%2284%22%20fill%3D%22%2370c5ce%22%2F%3E%0A%20%20%3Crect%20x%3D%220%22%20y%3D%2284%22%20width%3D%22100%22%20height%3D%2216%22%20fill%3D%22%23dcedc8%22%2F%3E%0A%20%20%3Crect%20x%3D%220%22%20y%3D%2284%22%20width%3D%22100%22%20height%3D%223%22%20fill%3D%22%2355b055%22%2F%3E%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate(20%2C%2023)%22%3E%0A%20%20%20%20%3C!--%20Row%200%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%220%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2218%22%20y%3D%220%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%220%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%220%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%220%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%220%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3C!--%20Row%201%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%226%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2218%22%20y%3D%226%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%226%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%226%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%226%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%226%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2248%22%20y%3D%226%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2254%22%20y%3D%226%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3C!--%20Row%202%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%2212%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2218%22%20y%3D%2212%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2212%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%2212%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%2212%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%2212%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2248%22%20y%3D%2212%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2254%22%20y%3D%2212%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3C!--%20Row%203%20--%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%226%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2218%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2248%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2254%22%20y%3D%2218%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3C!--%20Row%204%20--%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%226%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2218%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2248%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2254%22%20y%3D%2224%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3C!--%20Row%205%20--%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%226%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2218%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f7df00%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f75800%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f75800%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2248%22%20y%3D%2230%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f75800%22%2F%3E%0A%20%20%20%20%3C!--%20Row%206%20--%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%226%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23fff%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2218%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f75800%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f73030%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f73030%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2248%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f73030%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2254%22%20y%3D%2236%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3C!--%20Row%207%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%2242%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2218%22%20y%3D%2242%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2242%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f75800%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%2242%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23f75800%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%2242%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%2242%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2248%22%20y%3D%2242%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2254%22%20y%3D%2242%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3C!--%20Row%208%20--%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2248%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2230%22%20y%3D%2248%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%2248%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2242%22%20y%3D%2248%22%20width%3D%226%22%20height%3D%226%22%20fill%3D%22%23000%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E", controls: {flap: { label: "Flap", default: "Space" },restart: { label: "Restart", default: "KeyR" },}, factory: function createFlappy() {
  const KEYS = Store.bindings.resolve('Flappy Bird');
  const c = document.createElement('canvas'); c.id='flp';
  const ctx = c.getContext('2d'); c.width = 300; c.height = 250;
  UI.applyCanvasStyle(c, 300/250, 'Flappy Bird');
  let bird={y:120,v:0,g:0.2,j:-4,r:9}, pipes=[], score=0, over=false;

  function spawnPipe() { const h=20+Math.random()*90; pipes.push({x:300,t:h,b:250-(h+95),w:32}); }
  function die() { if (!over) { over=true; Store.scores.submit('Flappy Bird', score); } }
  function reset() { bird.y=120; bird.v=0; pipes=[]; score=0; over=false; spawnPipe(); }
  spawnPipe();

  return {
    el: c,
    onKey(code) {
      if (code===KEYS.flap    && !over) bird.v = bird.j;
      if (code===KEYS.restart &&  over) reset();
    },
    tick() {
      ctx.clearRect(0,0,300,250);
      ctx.fillStyle = '#70c5ce'; ctx.fillRect(0, 0, 300, 250);
      ctx.fillStyle='#dcedc8'; ctx.fillRect(0,210,300,40);
      ctx.fillStyle='#55b055'; ctx.fillRect(0,210,300,4);
      if (!over) {
        bird.v+=bird.g; bird.y+=bird.v;
        if (bird.y>203||bird.y<0) die();
        if (pipes.length===0||pipes[pipes.length-1].x<=140) spawnPipe();
        for (let i=pipes.length-1;i>=0;i--) {
          const op=pipes[i]; op.x-=1.5;
          if (op.x+op.w<0) { pipes.splice(i,1); score++; continue; }
          if (100+bird.r>op.x&&100-bird.r<op.x+op.w) if (bird.y-bird.r<op.t||bird.y+bird.r>250-op.b) die();
        }
        pipes.forEach(op => {
          const [g,d,w]=['#73bf2e','#558022','#9ce63c'];
          ctx.fillStyle=g; ctx.fillRect(op.x,0,op.w,op.t);
          ctx.fillStyle=d; ctx.fillRect(op.x,0,3,op.t); ctx.fillRect(op.x+op.w-3,0,3,op.t);
          ctx.fillStyle=w; ctx.fillRect(op.x+4,0,4,op.t);
          ctx.fillStyle=d; ctx.fillRect(op.x-2,op.t-12,op.w+4,12);
          ctx.fillStyle=g; ctx.fillRect(op.x-1,op.t-11,op.w+2,10);
          ctx.fillStyle=g; ctx.fillRect(op.x,250-op.b,op.w,op.b);
          ctx.fillStyle=d; ctx.fillRect(op.x,250-op.b,3,op.b); ctx.fillRect(op.x+op.w-3,250-op.b,3,op.b);
          ctx.fillStyle=w; ctx.fillRect(op.x+4,250-op.b,4,op.b);
          ctx.fillStyle=d; ctx.fillRect(op.x-2,250-op.b,op.w+4,12);
          ctx.fillStyle=g; ctx.fillRect(op.x-1,250-op.b+1,op.w+2,10);
        });
        const [Y,W,K,OR,R]=['#f7df00','#fff','#000','#f75800','#f73030'];
        Utils.drawColorPixels(ctx, 100-12, bird.y-10, 1.5, [
          [0,0,K,K,K,K,K,K],[0,0,K,Y,Y,Y,K,W,W,K], [0,0,K,Y,Y,Y,K,W,K,W,K],[K,K,K,Y,Y,Y,K,W,W,K],
          [K,W,W,K,Y,Y,Y,K,K,K],[K,W,W,W,K,Y,OR,OR,OR,OR,K], [K,W,W,K,OR,K,R,R,R,K],[0,0,K,K,OR,OR,K,K,K,K], [0,0,0,0,K,K,K,K]
        ]);
        ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
        ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=2; ctx.strokeText(score,150,30); ctx.fillText(score,150,30);
        ctx.shadowBlur=0; ctx.textAlign='left';
      } else {
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(0,0,300,250);
        ctx.fillStyle='#f17024'; ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.font='bold 20px sans-serif'; ctx.textAlign='center';
        ctx.strokeText('GAME OVER',150,100); ctx.fillText('GAME OVER',150,100);
        ctx.fillStyle='#fff'; ctx.font='11px sans-serif';
        ctx.fillText('Score: '+score, 150, 130);
        ctx.fillText('Best: '+Store.scores.get('Flappy Bird'), 150, 150);
        ctx.fillText('Press '+Utils.prettyKey(KEYS.restart)+' to Restart', 150, 170); ctx.textAlign='left';
      }
    },
    destroy() { c.remove(); }
  };
} },{ name: "Iso Racer", icon: "", controls: {debug: { label: "debug", default: "KeyV" },camera: { label: "camera", default: "KeyC" },select: { label: "select", default: "KeyX" },handbrake: { label: "handbrake", default: "Space" },restart: { label: "restart", default: "KeyR" },forward: { label: "forward", default: "KeyW" },back: { label: "back", default: "KeyS" },left: { label: "left", default: "KeyA" },right: { label: "right", default: "KeyD" },}, factory: function createIsoRacer() {
  // 1. Resolve Keybindings (MUST BE FIRST)
  const KEYS = Store.bindings.resolve('Iso Racer');
  
  // 2. Setup Canvas
  const W = 800, H = 600;
  const c = document.createElement('canvas');
  c.id = 'iso-racer-canvas';
  const ctx = c.getContext('2d');
  c.width = W; c.height = H;
  
  // 3. Apply Hub Window Style (MUST BE BEFORE RETURN)
  UI.applyCanvasStyle(c, W / H, 'Iso Racer');

  // 4. Initialize Offscreen WebGL Canvas
  const glCanvas = document.createElement('canvas');
  glCanvas.width = W; glCanvas.height = H;
  const gl = glCanvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });

  if (!gl) {
    return {
      el: c,
      onKey() {},
      tick() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WebGL not supported', W / 2, H / 2);
      },
      destroy() { c.remove(); }
    };
  }

  // 5. mat4 math library
  const mat4 = {
    create: () => new Float32Array(16),
    identity: (m) => { m[0]=1;m[1]=0;m[2]=0;m[3]=0; m[4]=0;m[5]=1;m[6]=0;m[7]=0; m[8]=0;m[9]=0;m[10]=1;m[11]=0; m[12]=0;m[13]=0;m[14]=0;m[15]=1; return m; },
    perspective: (m, fovy, aspect, near, far) => {
      const f = 1.0 / Math.tan(fovy / 2);
      const nf = 1 / (near - far);
      m[0]=f/aspect; m[1]=0; m[2]=0; m[3]=0;
      m[4]=0; m[5]=f; m[6]=0; m[7]=0;
      m[8]=0; m[9]=0; m[10]=(far+near)*nf; m[11]=-1;
      m[12]=0; m[13]=0; m[14]=2*far*near*nf; m[15]=0;
      return m;
    },
    ortho: (m, l, r, b, t, n, f) => {
      m[0] = 2 / (r - l); m[1] = 0; m[2] = 0; m[3] = 0;
      m[4] = 0; m[5] = 2 / (t - b); m[6] = 0; m[7] = 0;
      m[8] = 0; m[9] = 0; m[10] = -2 / (f - n); m[11] = 0;
      m[12] = -(l + r) / (r - l); m[13] = -(b + t) / (t - b); m[14] = -(n + f) / (f - n); m[15] = 1;
      return m;
    },
    lookAt: (m, eye, target, up) => {
      let z0=eye[0]-target[0], z1=eye[1]-target[1], z2=eye[2]-target[2];
      let len = 1/Math.hypot(z0,z1,z2); z0*=len; z1*=len; z2*=len;
      let x0=up[1]*z2-up[2]*z1, x1=up[2]*z0-up[0]*z2, x2=up[0]*z1-up[1]*z0;
      len=Math.hypot(x0,x1,x2); if(len===0){x0=0;x1=0;x2=0;} else {len=1/len; x0*=len;x1*=len;x2*=len;}
      let y0=z1*x2-z2*x1, y1=z2*x0-z0*x2, y2=z0*x1-z1*x0;
      m[0]=x0; m[1]=y0; m[2]=z0; m[3]=0;
      m[4]=x1; m[5]=y1; m[6]=z1; m[7]=0;
      m[8]=x2; m[9]=y2; m[10]=z2; m[11]=0;
      m[12]=-(x0*eye[0]+x1*eye[1]+x2*eye[2]);
      m[13]=-(y0*eye[0]+y1*eye[1]+y2*eye[2]);
      m[14]=-(z0*eye[0]+z1*eye[1]+z2*eye[2]);
      m[15]=1;
      return m;
    }
  };

  // 6. Shaders
  const vsSource = `
    attribute vec3 aPosition;
    attribute vec4 aColor;
    uniform mat4 uView;
    uniform mat4 uProj;
    varying vec4 vColor;
    void main() {
      gl_Position = uProj * uView * vec4(aPosition, 1.0);
      vColor = aColor;
    }
  `;
  const fsSource = `
    precision mediump float;
    varying vec4 vColor;
    void main() { gl_FragColor = vColor; }
  `;
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const positionLoc = gl.getAttribLocation(program, 'aPosition');
  const colorLoc    = gl.getAttribLocation(program, 'aColor');
  const uViewLoc    = gl.getUniformLocation(program, 'uView');
  const uProjLoc    = gl.getUniformLocation(program, 'uProj');

  const MAX_VERTICES = 500000;
  const webGLVertices = new Float32Array(MAX_VERTICES * 7);
  let webGLVertexCount = 0;

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, webGLVertices.byteLength, gl.DYNAMIC_DRAW);
  const FSIZE = 4;
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 7 * FSIZE, 0);
  gl.vertexAttribPointer(colorLoc,    4, gl.FLOAT, false, 7 * FSIZE, 3 * FSIZE);
  gl.enableVertexAttribArray(positionLoc);
  gl.enableVertexAttribArray(colorLoc);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearDepth(1.0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // 7. Game state
  let cameraMode = 0;
  let camPos = [0, 0, 1000];
  let camTarget = [0, 0, 0];
  let camUp = [0, 0, 1];
  let camFwdX = 0, camFwdY = 0, camFwdZ = 0;
  const viewMatrix = mat4.create();
  const projMatrix = mat4.create();

  let debugViz = false;
  let playerCar = null;

  const TIME_SCALE = 0.5, TARGET_TRACK_LENGTH = 10000;
  const CAR_HW = 9.0, CAR_HL = 20.0, ENGINE_POWER = 0.06;
  const MAX_SPEED_ON_ROAD = 18.0;

  let raceState = 'countdown', countdownTimer = 3.0, gameStartTime = null;
  let tickCount = 0;
  let prevPlayerLaps = 0;
  let isNewRecordFlash = 0;

  let trackPoints = [], roadQuads = [], trackWidth = 120, halfTrackIdx = 0;
  let kerbSides = [], kerbIntensity = [], vertNorms = [];
  let trackCenterX = 0, trackCenterY = 0;
  let grandstandPath = [], gsInDirs = [], grandstandBlocks = [], crowdPeople = [];
  let checkpoints = [], nextCheckpoint = 1, bots = [], trackCumDist = [];
  let wMinX = 0, wMaxX = 0, wMinY = 0, wMaxY = 0, miniScale = 1, miniCenterX = 0, miniCenterY = 0;

  let car = null;

  // 8. Helpers
  function project3D(wx, wy, wz) {
    let vx = viewMatrix[0]*wx + viewMatrix[4]*wy + viewMatrix[8]*wz + viewMatrix[12];
    let vy = viewMatrix[1]*wx + viewMatrix[5]*wy + viewMatrix[9]*wz + viewMatrix[13];
    let vz = viewMatrix[2]*wx + viewMatrix[6]*wy + viewMatrix[10]*wz + viewMatrix[14];
    let vw = viewMatrix[3]*wx + viewMatrix[7]*wy + viewMatrix[11]*wz + viewMatrix[15];
    let px = projMatrix[0]*vx + projMatrix[4]*vy + projMatrix[8]*vz + projMatrix[12]*vw;
    let py = projMatrix[1]*vx + projMatrix[5]*vy + projMatrix[9]*vz + projMatrix[13]*vw;
    let pz = projMatrix[2]*vx + projMatrix[6]*vy + projMatrix[10]*vz + projMatrix[14]*vw;
    let pw = projMatrix[3]*vx + projMatrix[7]*vy + projMatrix[11]*vz + projMatrix[15]*vw;
    if (pw === 0) return { visible: false };
    if (pz / pw < -1 || pz / pw > 1) return { visible: false };
    let ndcx = px / pw, ndcy = py / pw;
    return {
      sx: (ndcx * 0.5 + 0.5) * W,
      sy: (1.0 - (ndcy * 0.5 + 0.5)) * H,
      visible: true
    };
  }

  function getTeamColor() {
    let rand = Math.random(), r, g, b;
    if (rand < 0.25) { r = 200 + Math.floor(Math.random()*55); g = 40 + Math.floor(Math.random()*50); b = 40 + Math.floor(Math.random()*50); }
    else if (rand < 0.50) { r = 30 + Math.floor(Math.random()*50); g = 120 + Math.floor(Math.random()*50); b = 180 + Math.floor(Math.random()*50); }
    else if (rand < 0.75) { r = 20 + Math.floor(Math.random()*50); g = 180 + Math.floor(Math.random()*50); b = 90 + Math.floor(Math.random()*50); }
    else { r = 220 + Math.floor(Math.random()*35); g = 180 + Math.floor(Math.random()*50); b = Math.floor(Math.random()*50); }
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
  }
  function getNeutralColor() {
    let rand = Math.random(), r, g, b;
    if (rand < 0.6) { r = 200 + Math.floor(Math.random()*55); g = r; b = r; }
    else if (rand < 0.8) { r = 100 + Math.floor(Math.random()*50); g = r; b = r; }
    else { r = Math.floor(Math.random()*60); g = r; b = r; }
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
  }

  function generateTrack() {
    trackPoints = [];
    let numPts = 14 + Math.floor(Math.random() * 6);
    let baseR = 500;
    for (let i = 0; i < numPts; i++) {
      let angle = (i / numPts) * Math.PI * 2;
      let r = baseR + (Math.random() - 0.5) * 180;
      trackPoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    for (let it = 0; it < 4; it++) {
      let newPoints = [];
      for (let i = 0; i < trackPoints.length; i++) {
        let p0 = trackPoints[i], p1 = trackPoints[(i+1)%trackPoints.length];
        newPoints.push({ x: 0.75*p0.x + 0.25*p1.x, y: 0.75*p0.y + 0.25*p1.y });
        newPoints.push({ x: 0.25*p0.x + 0.75*p1.x, y: 0.25*p0.y + 0.75*p1.y });
      }
      trackPoints = newPoints;
    }

    let current_length = 0;
    for (let i = 0; i < trackPoints.length; i++) {
      let p0 = trackPoints[i], p1 = trackPoints[(i+1)%trackPoints.length];
      current_length += Math.hypot(p1.x - p0.x, p1.y - p0.y);
    }
    let scale_factor = TARGET_TRACK_LENGTH / current_length;
    trackPoints = trackPoints.map(p => ({ x: p.x * scale_factor, y: p.y * scale_factor }));

    trackCenterX = 0; trackCenterY = 0;
    trackPoints.forEach(p => { trackCenterX += p.x; trackCenterY += p.y; });
    trackCenterX /= trackPoints.length;
    trackCenterY /= trackPoints.length;

    roadQuads = [];
    let segNorms = [];
    for (let i = 0; i < trackPoints.length; i++) {
      let p0 = trackPoints[i], p1 = trackPoints[(i+1)%trackPoints.length];
      let dx = p1.x - p0.x, dy = p1.y - p0.y;
      let len = Math.sqrt(dx*dx + dy*dy);
      let nx = -dy / len, ny = dx / len;
      segNorms.push({ x: nx, y: ny });
      roadQuads.push({
        l1: {x: p0.x + nx*trackWidth/2, y: p0.y + ny*trackWidth/2},
        r1: {x: p0.x - nx*trackWidth/2, y: p0.y - ny*trackWidth/2},
        l2: {x: p1.x + nx*trackWidth/2, y: p1.y + ny*trackWidth/2},
        r2: {x: p1.x - nx*trackWidth/2, y: p1.y - ny*trackWidth/2}
      });
    }

    vertNorms = [];
    for (let i = 0; i < trackPoints.length; i++) {
      let n0 = segNorms[(i-1+trackPoints.length)%trackPoints.length];
      let n1 = segNorms[i];
      let vnx = (n0.x + n1.x), vny = (n0.y + n1.y);
      let vlen = Math.hypot(vnx, vny);
      if (vlen > 0) { vnx /= vlen; vny /= vlen; }
      vertNorms.push({ x: vnx, y: vny });
    }

    let gsOffset = trackWidth / 2 + 230;
    grandstandPath = trackPoints.map(p => {
      let vx = p.x - trackCenterX, vy = p.y - trackCenterY, d = Math.hypot(vx, vy);
      if (d === 0) return { x: p.x, y: p.y };
      return { x: p.x + (vx/d)*gsOffset, y: p.y + (vy/d)*gsOffset };
    });
    gsInDirs = grandstandPath.map(p => {
      let vx = trackCenterX - p.x, vy = trackCenterY - p.y, len = Math.hypot(vx, vy);
      if (len === 0) return { x: 0, y: 0 };
      return { x: vx/len, y: vy/len };
    });
    halfTrackIdx = Math.floor(trackPoints.length / 2);

    let rawCorners = new Array(roadQuads.length).fill(0);
    let win = 5;
    for (let i = 0; i < roadQuads.length; i++) {
      let p_prev = trackPoints[(i - win + roadQuads.length) % roadQuads.length];
      let p_curr = trackPoints[i];
      let p_next = trackPoints[(i + win) % roadQuads.length];
      let v1x = p_curr.x - p_prev.x, v1y = p_curr.y - p_prev.y;
      let v2x = p_next.x - p_curr.x, v2y = p_next.y - p_curr.y;
      let l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
      if (l1 > 0 && l2 > 0) {
        let cross = (v1x/l1) * (v2y/l2) - (v1y/l1) * (v2x/l2);
        if (cross > 0.25) rawCorners[i] = 1;
        if (cross < -0.25) rawCorners[i] = -1;
      }
    }
    kerbSides = new Array(roadQuads.length).fill(0);
    kerbIntensity = new Array(roadQuads.length).fill(0);
    for (let i = 0; i < roadQuads.length; i++) {
      if (rawCorners[i] !== 0) {
        for (let offset = -5; offset <= 5; offset++) {
          let idx = (i + offset + roadQuads.length) % roadQuads.length;
          if (kerbSides[idx] === 0) kerbSides[idx] = rawCorners[i];
        }
      }
    }
    let i = 0;
    while (i < roadQuads.length) {
      if (kerbSides[i] !== 0) {
        let start = i, len = 0;
        while (kerbSides[(start+len)%roadQuads.length] === kerbSides[start]) len++;
        for (let j = 0; j <= len; j++) {
          let idx = (start + j) % roadQuads.length;
          let intensity = 1.0, taperLen = Math.min(len * 0.3, 6.0);
          if (j < taperLen) intensity = j / taperLen;
          else if (j > len - taperLen) intensity = (len - j) / taperLen;
          intensity = Math.max(0, Math.min(1, intensity));
          intensity = intensity * intensity * (3 - 2 * intensity);
          kerbIntensity[idx] = Math.max(kerbIntensity[idx], intensity);
        }
        i += len;
      } else i++;
    }

    grandstandBlocks = [];
    crowdPeople = [];
    let tiers = 8, tH = 7.5, tD = 12;
    let standLen = Math.floor(grandstandPath.length / 5);
    let startIndices = [
      Math.floor(grandstandPath.length * 0.25),
      Math.floor(grandstandPath.length * 0.50),
      Math.floor(grandstandPath.length * 0.75)
    ];
    for (let s = 0; s < startIndices.length; s++) {
      let startIdx = startIndices[s];
      let standTeamColor = getTeamColor();
      let standTimer = 5;
      for (let i = 0; i < standLen; i++) {
        let idx0 = (startIdx + i) % grandstandPath.length;
        let idx1 = (startIdx + i + 1) % grandstandPath.length;
        let p0 = grandstandPath[idx0], p1 = grandstandPath[idx1];
        let dirIn0 = gsInDirs[idx0], dirIn1 = gsInDirs[idx1];
        if (standTimer <= 0) { standTeamColor = getTeamColor(); standTimer = 3 + Math.floor(Math.random() * 7); }
        standTimer--;
        let tierTeamColor = standTeamColor, tierTimer = 2;
        for (let t = 0; t < tiers; t++) {
          let z_top = (t + 1) * tH;
          let d_front = (tiers - t - 1) * tD, d_back = (tiers - t) * tD;
          let b0 = { x: p0.x + dirIn0.x * d_back, y: p0.y + dirIn0.y * d_back };
          let b1 = { x: p1.x + dirIn1.x * d_back, y: p1.y + dirIn1.y * d_back };
          let b2 = { x: p1.x + dirIn1.x * d_front, y: p1.y + dirIn1.y * d_front };
          let b3 = { x: p0.x + dirIn0.x * d_front, y: p0.y + dirIn0.y * d_front };
          grandstandBlocks.push({ b0, b1, b2, b3, z0: 0, z1: z_top, colorBase: '#2c3e50' });
          if (tierTimer <= 0) { tierTeamColor = getTeamColor(); tierTimer = 2 + Math.floor(Math.random() * 3); }
          tierTimer--;
          for (let r = 0; r < 2; r++) {
            for (let col = 0; col < 3; col++) {
              let u = (col + 0.5) / 3, v = (r === 0) ? 0.3 : 0.7;
              let edgeBackX = b0.x + u * (b1.x - b0.x), edgeBackY = b0.y + u * (b1.y - b0.y);
              let edgeFrontX = b3.x + u * (b2.x - b3.x), edgeFrontY = b3.y + u * (b2.y - b3.y);
              crowdPeople.push({
                x: edgeBackX + v * (edgeFrontX - edgeBackX),
                y: edgeBackY + v * (edgeFrontY - edgeBackY),
                z_base: z_top,
                w: 3.0 + Math.random() * 1.0, d: 3.0 + Math.random() * 1.0, h: 5.0 + Math.random() * 1.0,
                color: (Math.random() < 0.5) ? tierTeamColor : getNeutralColor(),
                phase: Math.random() * Math.PI * 2
              });
            }
          }
        }
      }
    }

    checkpoints = [];
    for (let i = 0; i < 8; i++) {
      let idx = Math.floor(trackPoints.length * i / 8);
      checkpoints.push({ x: trackPoints[idx].x, y: trackPoints[idx].y });
    }
    nextCheckpoint = 1;

    trackCumDist = [0];
    for (let i = 0; i < trackPoints.length; i++) {
      let p0 = trackPoints[i], p1 = trackPoints[(i+1)%trackPoints.length];
      trackCumDist.push(trackCumDist[i] + Math.hypot(p1.x-p0.x, p1.y-p0.y));
    }

    wMinX = Infinity; wMaxX = -Infinity; wMinY = Infinity; wMaxY = -Infinity;
    trackPoints.forEach(p => {
      if (p.x < wMinX) wMinX = p.x; if (p.x > wMaxX) wMaxX = p.x;
      if (p.y < wMinY) wMinY = p.y; if (p.y > wMaxY) wMaxY = p.y;
    });
    let trackSpan = Math.max(wMaxX - wMinX, wMaxY - wMinY);
    miniScale = (180 * 0.9 / Math.SQRT2) / trackSpan;
    miniCenterX = (wMinX + wMaxX) / 2;
    miniCenterY = (wMinY + wMaxY) / 2;
  }

  function spawnBots(startX, startY, gnx, gny) {
    bots = [];
    bots.push({ ...car, x: startX + gnx*15, y: startY + gny*15, color: '#e74c3c', name: 'Red',   isBot: true, skill: 0.95, lineOffset: (Math.random()-0.5)*50, targetIdx: -1, targetX: 0, targetY: 0, lbY: 0 });
    bots.push({ ...car, x: startX - gnx*15, y: startY - gny*15, color: '#2ecc71', name: 'Green', isBot: true, skill: 0.98, lineOffset: (Math.random()-0.5)*50, targetIdx: -1, targetX: 0, targetY: 0, lbY: 0 });
    bots.push({ ...car, x: startX - gnx*45, y: startY - gny*45, color: '#3498db', name: 'Blue',  isBot: true, skill: 0.92, lineOffset: (Math.random()-0.5)*50, targetIdx: -1, targetX: 0, targetY: 0, lbY: 0 });
  }

  function initRace() {
    generateTrack();
    let p0 = trackPoints[0], p1 = trackPoints[1];
    let gdx = p1.x - p0.x, gdy = p1.y - p0.y;
    let glen = Math.hypot(gdx, gdy);
    let gfx = gdx / glen, gfy = gdy / glen;
    let gnx = -gfy, gny = gfx;
    let startX = p0.x - gfx*50, startY = p0.y - gfy*50;

    car = {
      x: startX + gnx*45, y: startY + gny*45,
      angle: Math.atan2(gdy, gdx),
      vx: 0, vy: 0, angVel: 0, speed: 0, steer: 0,
      laps: 0, prevIdx: 0, isBot: false, color: '#f1c40f', name: 'Yellow',
      skill: 1.0, lineOffset: 0, lbY: 0, targetIdx: -1, targetX: 0, targetY: 0,
      progress: 0
    };
    spawnBots(startX, startY, gnx, gny);
    let allCarsInit = [car, ...bots];
    playerCar = allCarsInit[Math.floor(Math.random() * allCarsInit.length)];
    prevPlayerLaps = 0;
    raceState = 'countdown';
    countdownTimer = 3.0;
    gameStartTime = null;
    tickCount = 0;
    isNewRecordFlash = 0;
  }
  initRace();

  function getCarState(x, y) {
    let minDist = Infinity, closestIdx = 0, distAlong = 0;
    for (let i = 0; i < trackPoints.length; i++) {
      let p0 = trackPoints[i], p1 = trackPoints[(i+1)%trackPoints.length];
      let dx = p1.x - p0.x, dy = p1.y - p0.y, l2 = dx*dx + dy*dy;
      if (l2 === 0) continue;
      let t = Math.max(0, Math.min(1, ((x - p0.x) * dx + (y - p0.y) * dy) / l2));
      let cx = p0.x + t * dx, cy = p0.y + t * dy;
      let dist = Math.hypot(x - cx, y - cy);
      if (dist < minDist) { minDist = dist; closestIdx = i; distAlong = t * Math.sqrt(l2); }
    }
    return { idx: closestIdx, distAlong, dist: minDist, offRoad: minDist > trackWidth / 2 - 6 };
  }

  const hexToRgb = (hex) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
  };
  const shadeHexColor = (hex, percent) => {
    let [r,g,b] = hexToRgb(hex);
    r = Math.max(0, Math.floor(r * percent));
    g = Math.max(0, Math.floor(g * percent));
    b = Math.max(0, Math.floor(b * percent));
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
  };

  function addWebGLFace(pts, hex, alpha = 1.0) {
    if (webGLVertexCount + 42 > MAX_VERTICES * 7) return;
    let [r,g,b] = hexToRgb(hex);
    r /= 255; g /= 255; b /= 255;
    const indices = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) {
      let p = pts[indices[i]];
      webGLVertices[webGLVertexCount++] = p[0];
      webGLVertices[webGLVertexCount++] = p[1];
      webGLVertices[webGLVertexCount++] = p[2];
      webGLVertices[webGLVertexCount++] = r;
      webGLVertices[webGLVertexCount++] = g;
      webGLVertices[webGLVertexCount++] = b;
      webGLVertices[webGLVertexCount++] = alpha;
    }
  }

  function drawVehicle(x, y, angle, colorBase) {
    const cosA = Math.cos(angle), sinA = Math.sin(angle), sz = 0.6;
    const getVertex = (u, v, w) => {
      const lu = u*sz, lv = v*sz, lw = w*sz;
      return [lu*cosA - lv*sinA + x, lu*sinA + lv*cosA + y, lw];
    };
    const addFace = (pts, hex) => addWebGLFace(pts.map(p => getVertex(p[0],p[1],p[2])), hex);
    const hl = 24, hw = 11, bh = 6;
    const ch_f = 8, ch_b = -16, ch_w = 9, ch_h = 14;
    const s_u = -22, s_w = 12, s_h = 12;

    let colorFront = shadeHexColor(colorBase, 0.85);
    let colorRight = shadeHexColor(colorBase, 0.70);
    let colorBack  = shadeHexColor(colorBase, 0.55);
    let colorLeft  = shadeHexColor(colorBase, 0.70);
    let colorBottom= shadeHexColor(colorBase, 0.30);

    addFace([[hl,-hw,bh],[hl,hw,bh],[-hl,hw,bh],[-hl,-hw,bh]], colorBase);
    addFace([[hl,-hw,0],[hl,hw,0],[hl,hw,bh],[hl,-hw,bh]], colorFront);
    addFace([[-hl,-hw,0],[-hl,-hw,bh],[-hl,hw,bh],[-hl,hw,0]], colorBack);
    addFace([[hl,hw,0],[-hl,hw,0],[-hl,hw,bh],[hl,hw,bh]], colorRight);
    addFace([[-hl,-hw,0],[hl,-hw,0],[hl,-hw,bh],[-hl,-hw,bh]], colorLeft);
    addFace([[hl,-hw,0],[-hl,-hw,0],[-hl,hw,0],[hl,hw,0]], colorBottom);

    addFace([[ch_f,-ch_w,bh],[ch_f,ch_w,bh],[ch_f,ch_w,ch_h],[ch_f,-ch_w,ch_h]], '#222');
    addFace([[ch_b,-ch_w,bh],[ch_b,-ch_w,ch_h],[ch_b,ch_w,ch_h],[ch_b,ch_w,bh]], '#222');
    addFace([[ch_f,-ch_w,bh],[ch_b,-ch_w,bh],[ch_b,-ch_w,ch_h],[ch_f,-ch_w,ch_h]], '#111');
    addFace([[ch_f,ch_w,bh],[ch_f,ch_w,ch_h],[ch_b,ch_w,ch_h],[ch_b,ch_w,bh]], '#111');
    addFace([[ch_f,-ch_w,ch_h],[ch_f,ch_w,ch_h],[ch_b,ch_w,ch_h],[ch_b,-ch_w,ch_h]], '#333');

    addFace([[s_u-2,-s_w,bh],[s_u-2,s_w,bh],[s_u-2,s_w,s_h],[s_u-2,-s_w,s_h]], '#222');
    addFace([[s_u+2,-s_w,bh],[s_u+2,-s_w,s_h],[s_u+2,s_w,s_h],[s_u+2,s_w,bh]], '#111');
    addFace([[s_u-2,-s_w,s_h],[s_u+2,-s_w,s_h],[s_u+2,s_w,s_h],[s_u-2,s_w,s_h]], '#333');
    addFace([[s_u-2,-s_w,bh],[s_u+2,-s_w,bh],[s_u+2,-s_w,s_h],[s_u-2,-s_w,s_h]], '#1a1a1a');
    addFace([[s_u-2,s_w,bh],[s_u+2,s_w,bh],[s_u+2,s_w,s_h],[s_u-2,s_w,s_h]], '#1a1a1a');

    const addWheel = (u, v) => {
      const wu = 7, wv = 4, wh = 7;
      addFace([[u-wu,v-wv,wh],[u-wu,v+wv,wh],[u+wu,v+wv,wh],[u+wu,v-wv,wh]], '#222');
      addFace([[u+wu,v-wv,0],[u+wu,v-wv,wh],[u+wu,v+wv,wh],[u+wu,v+wv,0]], '#000');
      addFace([[u-wu,v-wv,0],[u-wu,v-wv,wh],[u-wu,v+wv,wh],[u-wu,v+wv,0]], '#000');
      addFace([[u-wu,v+wv,0],[u-wu,v+wv,wh],[u+wu,v+wv,wh],[u+wu,v+wv,0]], '#111');
      addFace([[u+wu,v-wv,0],[u+wu,v-wv,wh],[u-wu,v-wv,wh],[u-wu,v-wv,0]], '#111');
    };
    addWheel(14, 12); addWheel(-14, 12); addWheel(14, -12); addWheel(-14, -12);

    addFace([[hl+0.1,4,2],[hl+0.1,9,2],[hl+0.1,9,4],[hl+0.1,4,4]], '#ffff00');
    addFace([[hl+0.1,-9,2],[hl+0.1,-4,2],[hl+0.1,-4,4],[hl+0.1,-9,4]], '#ffff00');
    addFace([[-hl-0.1,4,2],[-hl-0.1,9,2],[-hl-0.1,9,4],[-hl-0.1,4,4]], '#ff0000');
    addFace([[-hl-0.1,-9,2],[-hl-0.1,-4,2],[-hl-0.1,-4,4],[-hl-0.1,-9,4]], '#ff0000');
  }

  function drawGuardrailSeg(o0, o1, i0, i1) {
    const drawBar = (z_bottom, z_top) => {
      addWebGLFace([[o0.x,o0.y,z_bottom],[o1.x,o1.y,z_bottom],[o1.x,o1.y,z_top],[o0.x,o0.y,z_top]], '#586069');
      addWebGLFace([[i0.x,i0.y,z_bottom],[i1.x,i1.y,z_bottom],[i1.x,i1.y,z_top],[i0.x,i0.y,z_top]], '#8b949e');
      addWebGLFace([[o0.x,o0.y,z_top],[o1.x,o1.y,z_top],[i1.x,i1.y,z_top],[i0.x,i0.y,z_top]], '#c9d1d9');
      addWebGLFace([[o0.x,o0.y,z_bottom],[i0.x,i0.y,z_bottom],[i1.x,i1.y,z_bottom],[o1.x,o1.y,z_bottom]], '#586069');
      addWebGLFace([[o0.x,o0.y,z_bottom],[i0.x,i0.y,z_bottom],[i0.x,i0.y,z_top],[o0.x,o0.y,z_top]], '#586069');
      addWebGLFace([[o1.x,o1.y,z_bottom],[i1.x,i1.y,z_bottom],[i1.x,i1.y,z_top],[o1.x,o1.y,z_top]], '#586069');
    };
    drawBar(2, 5); drawBar(7, 10); drawBar(12, 15);
  }

  function drawBox3D(p0, p1, p2, p3, z0, z1, colorBase) {
    let colorFront = shadeHexColor(colorBase, 0.85);
    let colorRight = shadeHexColor(colorBase, 0.70);
    let colorBack  = shadeHexColor(colorBase, 0.55);
    let colorLeft  = shadeHexColor(colorBase, 0.70);
    let colorBottom= shadeHexColor(colorBase, 0.30);
    addWebGLFace([[p0.x,p0.y,z0],[p1.x,p1.y,z0],[p2.x,p2.y,z0],[p3.x,p3.y,z0]], colorBottom);
    addWebGLFace([[p0.x,p0.y,z1],[p1.x,p1.y,z1],[p2.x,p2.y,z1],[p3.x,p3.y,z1]], colorBase);
    addWebGLFace([[p0.x,p0.y,z0],[p1.x,p1.y,z0],[p1.x,p1.y,z1],[p0.x,p0.y,z1]], colorBack);
    addWebGLFace([[p1.x,p1.y,z0],[p2.x,p2.y,z0],[p2.x,p2.y,z1],[p1.x,p1.y,z1]], colorRight);
    addWebGLFace([[p2.x,p2.y,z0],[p3.x,p3.y,z0],[p3.x,p3.y,z1],[p2.x,p2.y,z1]], colorFront);
    addWebGLFace([[p3.x,p3.y,z0],[p0.x,p0.y,z0],[p0.x,p0.y,z1],[p3.x,p3.y,z1]], colorLeft);
  }

  function getOBBCorners(x, y, angle, hw, hl) {
    let cos = Math.cos(angle), sin = Math.sin(angle);
    return [
      { x: x + cos*hl - sin*hw, y: y + sin*hl + cos*hw },
      { x: x + cos*hl + sin*hw, y: y + sin*hl - cos*hw },
      { x: x - cos*hl + sin*hw, y: y - sin*hl - cos*hw },
      { x: x - cos*hl - sin*hw, y: y - sin*hl + cos*hw }
    ];
  }
  function projectCorners(corners, axis) {
    let min = Infinity, max = -Infinity;
    for (let c of corners) {
      let dot = c.x * axis.x + c.y * axis.y;
      if (dot < min) min = dot;
      if (dot > max) max = dot;
    }
    return { min, max };
  }
  function resolveOBB(c1, c2) {
    if (Math.hypot(c1.x - c2.x, c1.y - c2.y) > 60) return;
    let corners1 = getOBBCorners(c1.x, c1.y, c1.angle, CAR_HW, CAR_HL);
    let corners2 = getOBBCorners(c2.x, c2.y, c2.angle, CAR_HW, CAR_HL);
    let axes = [
      { x: Math.cos(c1.angle), y: Math.sin(c1.angle) },
      { x: -Math.sin(c1.angle), y: Math.cos(c1.angle) },
      { x: Math.cos(c2.angle), y: Math.sin(c2.angle) },
      { x: -Math.sin(c2.angle), y: Math.cos(c2.angle) }
    ];
    let minOverlap = Infinity, mtvAxis = null;
    for (let axis of axes) {
      let p1 = projectCorners(corners1, axis), p2 = projectCorners(corners2, axis);
      let overlap = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
      if (overlap <= 0) return;
      if (overlap < minOverlap) { minOverlap = overlap; mtvAxis = axis; }
    }
    let dx = c2.x - c1.x, dy = c2.y - c1.y;
    if (dx * mtvAxis.x + dy * mtvAxis.y < 0) mtvAxis = { x: -mtvAxis.x, y: -mtvAxis.y };
    c1.x -= mtvAxis.x * minOverlap / 2; c1.y -= mtvAxis.y * minOverlap / 2;
    c2.x += mtvAxis.x * minOverlap / 2; c2.y += mtvAxis.y * minOverlap / 2;
    let contactX = 0, contactY = 0, contactCount = 0;
    function pointInOBB(p, c) {
      let dx = p.x - c.x, dy = p.y - c.y;
      let cos = Math.cos(-c.angle), sin = Math.sin(-c.angle);
      let lx = dx*cos - dy*sin, ly = dx*sin + dy*cos;
      return Math.abs(lx) <= CAR_HL && Math.abs(ly) <= CAR_HW;
    }
    for (let p of corners1) if (pointInOBB(p, c2)) { contactX += p.x; contactY += p.y; contactCount++; }
    for (let p of corners2) if (pointInOBB(p, c1)) { contactX += p.x; contactY += p.y; contactCount++; }
    if (contactCount > 0) { contactX /= contactCount; contactY /= contactCount; }
    else { contactX = (c1.x + c2.x)/2; contactY = (c1.y + c2.y)/2; }
    let r1x = contactX - c1.x, r1y = contactY - c1.y, r2x = contactX - c2.x, r2y = contactY - c2.y;
    let v1px = c1.vx - c1.angVel * r1y, v1py = c1.vy + c1.angVel * r1x;
    let v2px = c2.vx - c2.angVel * r2y, v2py = c2.vy + c2.angVel * r2x;
    let rvx = v2px - v1px, rvy = v2py - v1py;
    let velAlongNormal = rvx * mtvAxis.x + rvy * mtvAxis.y;
    if (velAlongNormal > 0) return;
    let restitution = 0.4, m1 = 1.0, m2 = 1.0;
    let I1 = (CAR_HW*CAR_HW + CAR_HL*CAR_HL) / 3.0, I2 = I1;
    let r1CrossN = r1x * mtvAxis.y - r1y * mtvAxis.x, r2CrossN = r2x * mtvAxis.y - r2y * mtvAxis.x;
    let invMassSum = (1/m1) + (1/m2) + (r1CrossN*r1CrossN)/I1 + (r2CrossN*r2CrossN)/I2;
    let j = -(1.0 + restitution) * velAlongNormal / invMassSum;
    let impulseX = mtvAxis.x * j, impulseY = mtvAxis.y * j;
    c1.vx -= impulseX / m1; c1.vy -= impulseY / m1;
    c2.vx += impulseX / m2; c2.vy += impulseY / m2;
    c1.angVel -= (r1x * impulseY - r1y * impulseX) / I1;
    c2.angVel += (r2x * impulseY - r2y * impulseX) / I2;
  }

  // 2D Drawing helpers
  function moveTo3D(x, y, z) { let p = project3D(x,y,z); if (p.visible) ctx.moveTo(p.sx, p.sy); return p.visible; }
  function lineTo3D(x, y, z) { let p = project3D(x,y,z); if (p.visible) ctx.lineTo(p.sx, p.sy); return p.visible; }

  function drawHitboxes() {
    const allCars = [car, ...bots];
    allCars.forEach((ac) => {
      const corners = getOBBCorners(ac.x, ac.y, ac.angle, CAR_HW, CAR_HL);
      const isPlayer = ac === playerCar;
      const color = isPlayer ? '#00ffff' : '#ff00ff';
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      let started = false;
      for (let i = 0; i < 4; i++) {
        if (moveTo3D(corners[i].x, corners[i].y, 0.5)) started = true;
        else if (started) break;
      }
      if (started) {
        for (let i = 1; i <= 4; i++) if (!lineTo3D(corners[i%4].x, corners[i%4].y, 0.5)) break;
        ctx.stroke();
      }
      const center = project3D(ac.x, ac.y, 0.5);
      const fwd = project3D(ac.x + Math.cos(ac.angle)*15, ac.y + Math.sin(ac.angle)*15, 0.5);
      if (center.visible) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(center.sx, center.sy, 3, 0, Math.PI*2); ctx.fill();
        if (fwd.visible) { ctx.beginPath(); ctx.moveTo(center.sx, center.sy); ctx.lineTo(fwd.sx, fwd.sy); ctx.stroke(); }
      }
      if (Math.hypot(ac.vx, ac.vy) > 0.5) {
        const velEnd = project3D(ac.x + ac.vx*5, ac.y + ac.vy*5, 0.5);
        if (center.visible && velEnd.visible) {
          ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(center.sx, center.sy); ctx.lineTo(velEnd.sx, velEnd.sy); ctx.stroke();
        }
      }
    });
    allCars.forEach(bot => {
      if (bot === playerCar || bot.targetIdx === -1) return;
      const bp = project3D(bot.x, bot.y, 0.5);
      const tp = project3D(bot.targetX, bot.targetY, 0.5);
      if (bp.visible && tp.visible) {
        ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bp.sx, bp.sy); ctx.lineTo(tp.sx, tp.sy); ctx.stroke();
        ctx.fillStyle = '#00ff00'; ctx.beginPath(); ctx.arc(tp.sx, tp.sy, 5, 0, Math.PI*2); ctx.fill();
      }
    });
    const boundary = trackWidth/2 + 100;
    ctx.strokeStyle = 'rgba(255,80,80,0.5)'; ctx.lineWidth = 2;
    for (let dir = 1; dir >= -1; dir -= 2) {
      ctx.beginPath(); let started = false;
      for (let i = 0; i < trackPoints.length; i++) {
        const p = trackPoints[i];
        const vx = p.x - trackCenterX, vy = p.y - trackCenterY, d = Math.hypot(vx,vy);
        if (moveTo3D(p.x + (vx/d)*boundary*dir, p.y + (vy/d)*boundary*dir, 0.5)) started = true;
        else if (started) break;
      }
      if (started) ctx.stroke();
    }
    const offRoadThreshold = trackWidth/2 - 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([5,5]);
    for (let dir = 1; dir >= -1; dir -= 2) {
      ctx.beginPath(); let started = false;
      for (let i = 0; i < trackPoints.length; i++) {
        const p = trackPoints[i];
        const vx = p.x - trackCenterX, vy = p.y - trackCenterY, d = Math.hypot(vx,vy);
        if (moveTo3D(p.x + (vx/d)*offRoadThreshold*dir, p.y + (vy/d)*offRoadThreshold*dir, 0.5)) started = true;
        else if (started) break;
      }
      if (started) ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const cp_next_idx = Math.floor(trackPoints.length * (i+1) / checkpoints.length) % trackPoints.length;
      const cp_next = trackPoints[cp_next_idx];
      const dx = cp_next.x - cp.x, dy = cp_next.y - cp.y, len = Math.hypot(dx,dy);
      const nx = -dy/len, ny = dx/len;
      const sp1 = project3D(cp.x + nx*trackWidth/2, cp.y + ny*trackWidth/2, 1);
      const sp2 = project3D(cp.x - nx*trackWidth/2, cp.y - ny*trackWidth/2, 1);
      if (sp1.visible && sp2.visible) {
        ctx.strokeStyle = (i === nextCheckpoint) ? '#00ffff' : 'rgba(0,255,0,0.6)';
        ctx.beginPath(); ctx.moveTo(sp1.sx, sp1.sy); ctx.lineTo(sp2.sx, sp2.sy); ctx.stroke();
      }
    }
    const boundaryOffset = trackWidth/2 + 115;
    ctx.strokeStyle = 'rgba(255,100,0,0.5)'; ctx.lineWidth = 1.5;
    for (let dir = 1; dir >= -1; dir -= 2) {
      ctx.beginPath(); let started = false;
      for (let i = 0; i < trackPoints.length; i++) {
        const p = trackPoints[i];
        const vx = p.x - trackCenterX, vy = p.y - trackCenterY, d = Math.hypot(vx,vy);
        if (moveTo3D(p.x + (vx/d)*boundaryOffset*dir, p.y + (vy/d)*boundaryOffset*dir, 0.5)) started = true;
        else if (started) break;
      }
      if (started) ctx.stroke();
    }
  }

  function drawMinimap() {
    const miniSize = 180, miniPad = 20;
    const miniX = W - miniSize - miniPad, miniY = miniPad;
    const mx_center = miniX + miniSize/2, my_center = miniY + miniSize/2;
    ctx.save();
    ctx.translate(mx_center, my_center); ctx.rotate(Math.PI/4); ctx.translate(-mx_center, -my_center);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < trackPoints.length; i++) {
      let mx = mx_center + (trackPoints[i].x - miniCenterX) * miniScale;
      let my = my_center + (trackPoints[i].y - miniCenterY) * miniScale;
      if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
    }
    ctx.closePath(); ctx.stroke();
    let p0 = trackPoints[0], p1 = trackPoints[1];
    let dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.sqrt(dx*dx + dy*dy);
    let nx = -dy/len, ny = dx/len;
    let m1x = mx_center + (p0.x + nx*trackWidth/2 - miniCenterX) * miniScale;
    let m1y = my_center + (p0.y + ny*trackWidth/2 - miniCenterY) * miniScale;
    let m2x = mx_center + (p0.x - nx*trackWidth/2 - miniCenterX) * miniScale;
    let m2y = my_center + (p0.y - ny*trackWidth/2 - miniCenterY) * miniScale;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(m1x, m1y); ctx.lineTo(m2x, m2y); ctx.stroke();
    let allCars = [car, ...bots];
    for (let ac of allCars) {
      let mx = mx_center + (ac.x - miniCenterX) * miniScale;
      let my = my_center + (ac.y - miniCenterY) * miniScale;
      ctx.save();
      ctx.translate(mx, my); ctx.rotate(ac.angle);
      ctx.fillStyle = ac.color;
      ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-3,-3); ctx.lineTo(-3,3); ctx.closePath();
      ctx.fill();
      if (ac === playerCar) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawLeaderboard(racers) {
    let lbX = 20, lbY = H - 130;
    let lbW = 180, lbH = 20 + racers.length * 24;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(lbX, lbY, lbW, lbH);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(lbX, lbY, lbW, lbH);
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('LEADERBOARD', lbX + 10, lbY + 20);
    for (let i = 0; i < racers.length; i++) {
      let r = racers[i], rY = r.car.lbY;
      ctx.fillStyle = '#fff';
      ctx.fillText((i+1) + '.', lbX + 10, rY);
      ctx.fillStyle = r.car.color;
      ctx.fillRect(lbX + 30, rY - 6, 12, 12);
      ctx.fillStyle = '#fff';
      let name = (r.car === playerCar) ? 'You (' + r.car.name + ')' : r.car.name;
      ctx.fillText(name, lbX + 50, rY);
    }
    ctx.textBaseline = 'alphabetic';
  }

  function applyCarController(carObj, throttle, brake, steerInput, handbrake, offRoad, dt) {
    let cosA = Math.cos(carObj.angle), sinA = Math.sin(carObj.angle);
    let fwd = carObj.vx * cosA + carObj.vy * sinA;
    let speed = Math.hypot(carObj.vx, carObj.vy);
    const MAX_SPEED = offRoad ? 9.0 : 18.0;
    const BRAKE_FORCE = 0.5;
    if (throttle > 0) {
      let torque = 1 - Math.min(fwd / MAX_SPEED, 1);
      let force = ENGINE_POWER * torque * dt * throttle;
      carObj.vx += cosA * force; carObj.vy += sinA * force;
    }
    if (brake > 0) {
      if (fwd > 0.05) {
        let force = BRAKE_FORCE * dt * brake;
        carObj.vx -= cosA * force; carObj.vy -= sinA * force;
      } else {
        let revForce = (ENGINE_POWER * 0.5) * dt * brake;
        if (fwd > -6.0) { carObj.vx -= cosA * revForce; carObj.vy -= sinA * revForce; }
      }
    }
    if (throttle === 0 && brake === 0) { carObj.vx *= 0.99; carObj.vy *= 0.99; }
    if (offRoad) { carObj.vx *= 0.98; carObj.vy *= 0.98; }
    const TURN_RATE = 0.04;
    let turnSpeed = TURN_RATE * (1 - Math.min(speed / MAX_SPEED, 0.6));
    let targetAngVel = steerInput * turnSpeed;
    carObj.angVel += (targetAngVel - carObj.angVel) * 0.2;
    carObj.angle += carObj.angVel * dt;
    if (Math.abs(steerInput) < 0.01) carObj.angVel *= 0.8;
    fwd = carObj.vx * cosA + carObj.vy * sinA;
    let lat = -carObj.vx * sinA + carObj.vy * cosA;
    let baseGrip = handbrake ? 0.05 : 0.20;
    if (offRoad) baseGrip *= 0.5;
    if (Math.abs(lat) > 6.0) baseGrip *= 0.5;
    lat *= (1 - baseGrip);
    carObj.vx = fwd * cosA - lat * sinA;
    carObj.vy = fwd * sinA + lat * cosA;
    carObj.x += carObj.vx * dt;
    carObj.y += carObj.vy * dt;
    carObj.speed = Math.hypot(carObj.vx, carObj.vy);
  }

  // 9. Return Game Object Contract
  return {
    el: c,
    onKey(code) {
      if (code === KEYS.debug)   debugViz = !debugViz;
      if (code === KEYS.camera)  cameraMode = (cameraMode + 1) % 2;

      if (code === KEYS.select) {
        if (raceState === 'countdown' || raceState === 'selection') {
          if (raceState === 'countdown') raceState = 'selection';
          const allRacers = [car, ...bots];
          let idx = allRacers.indexOf(playerCar);
          playerCar = allRacers[(idx + 1) % allRacers.length];
        }
      }
      if (code === KEYS.handbrake) {
        if (raceState === 'selection') raceState = 'countdown';
      }
      if (code === KEYS.restart) {
        initRace();
      }
    },
    tick() {
      const dt_real = 1 / 60;
      const dt = dt_real * 60 * TIME_SCALE;
      tickCount += 1;
      let allCars = [car, ...bots];

      if (raceState === 'racing') {
        // Bot AI
        for (let bot of allCars) {
          if (bot === playerCar) continue;
          let bState = getCarState(bot.x, bot.y);
          let idxDiff = (bState.idx - bot.targetIdx + trackPoints.length) % trackPoints.length;
          if (!bot.targetIdx || bot.targetIdx === -1 || idxDiff < 2) {
            bot.targetIdx = (bState.idx + 5 + Math.floor(Math.random()*3)) % trackPoints.length;
            let p = trackPoints[bot.targetIdx], n = vertNorms[bot.targetIdx];
            bot.targetX = p.x + n.x * bot.lineOffset;
            bot.targetY = p.y + n.y * bot.lineOffset;
          }
          let dx = bot.targetX - bot.x, dy = bot.targetY - bot.y;
          let desiredAngle = Math.atan2(dy, dx);
          let angleDiff = desiredAngle - bot.angle;
          while (angleDiff >  Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
          let steerInput = Math.max(-1, Math.min(1, angleDiff * 1.5));
          for (let other of allCars) {
            if (other === bot) continue;
            let ddx = other.x - bot.x, ddy = other.y - bot.y, dist = Math.hypot(ddx, ddy);
            if (dist < 60) {
              let other_fwd = ddx * Math.cos(bot.angle) + ddy * Math.sin(bot.angle);
              if (other_fwd > -5 && other_fwd < 50) {
                let other_lat = -ddx * Math.sin(bot.angle) + ddy * Math.cos(bot.angle);
                if (Math.abs(other_lat) < 20) {
                  let push_dir = other_lat === 0 ? 1 : Math.sign(other_lat);
                  steerInput += push_dir * (20 - Math.abs(other_lat)) * 0.05;
                  steerInput = Math.max(-1, Math.min(1, steerInput));
                }
              }
            }
          }
          let p0_t = trackPoints[bState.idx], p1_t = trackPoints[(bState.idx+1)%trackPoints.length];
          let track_angle = Math.atan2(p1_t.y - p0_t.y, p1_t.x - p0_t.x);
          let future_idx = (bState.idx + 10) % trackPoints.length;
          let future_p0 = trackPoints[future_idx], future_p1 = trackPoints[(future_idx+1)%trackPoints.length];
          let future_angle = Math.atan2(future_p1.y - future_p0.y, future_p1.x - future_p0.x);
          let future_angle_diff = future_angle - track_angle;
          while (future_angle_diff >  Math.PI) future_angle_diff -= 2 * Math.PI;
          while (future_angle_diff < -Math.PI) future_angle_diff += 2 * Math.PI;
          let maxBotSpeed = 17.0;
          let turnSharpness = Math.abs(future_angle_diff);
          let targetSpeed = maxBotSpeed * bot.skill * (1 - Math.min(turnSharpness / 0.6, 0.8));
          if (bState.offRoad) targetSpeed = Math.min(targetSpeed, 9.0);
          let throttle = 0, brake = 0;
          if (bot.speed < targetSpeed)        { throttle = 1; brake = 0; }
          else if (bot.speed > targetSpeed+2) { brake = 1; throttle = 0; }
          if (bot.speed < 1.0)                { throttle = 1; brake = 0; }
          applyCarController(bot, throttle, brake, steerInput, false, bState.offRoad, dt);
        }

        // Player input (held-down continuous keys)
        let trackState = getCarState(playerCar.x, playerCar.y);
        let offRoad = trackState.offRoad;
        let pThrottle = Hub.keys[KEYS.forward] ? 1 : 0;
        let pBrake    = Hub.keys[KEYS.back]    ? 1 : 0;
        let pSteer = 0;
        if (Hub.keys[KEYS.left])  pSteer = -1;
        if (Hub.keys[KEYS.right]) pSteer =  1;
        let pHandbrake = !!Hub.keys[KEYS.handbrake];
        applyCarController(playerCar, pThrottle, pBrake, pSteer, pHandbrake, offRoad, dt);

        // Boundary enforcement
        const boundaryLimit = trackWidth / 2 + 100;
        for (let c of allCars) {
          let st = getCarState(c.x, c.y);
          if (st.dist > boundaryLimit) {
            let p0 = trackPoints[st.idx], p1 = trackPoints[(st.idx+1)%trackPoints.length];
            let dxs = p1.x - p0.x, dys = p1.y - p0.y, ls = dxs*dxs + dys*dys;
            let ts = Math.max(0, Math.min(1, ((c.x - p0.x)*dxs + (c.y - p0.y)*dys) / ls));
            let cx = p0.x + ts*dxs, cy = p0.y + ts*dys;
            let pushX = cx - c.x, pushY = cy - c.y;
            let pushLen = Math.hypot(pushX, pushY);
            let normX = pushX / pushLen, normY = pushY / pushLen;
            c.x = cx - normX * boundaryLimit; c.y = cy - normY * boundaryLimit;
            let dot = c.vx * (-normX) + c.vy * (-normY);
            if (dot > 0) { c.vx -= dot * (-normX) * 1.8; c.vy -= dot * (-normY) * 1.8; }
          }
        }
        for (let i = 0; i < allCars.length; i++)
          for (let j = i+1; j < allCars.length; j++) resolveOBB(allCars[i], allCars[j]);
      } else if (raceState === 'countdown') {
        countdownTimer -= dt_real;
        if (countdownTimer <= -0.5) { raceState = 'racing'; gameStartTime = Date.now(); }
        for (let ac of allCars) { ac.vx = 0; ac.vy = 0; ac.angVel = 0; ac.speed = 0; }
      } else if (raceState === 'selection') {
        for (let ac of allCars) { ac.vx = 0; ac.vy = 0; ac.angVel = 0; ac.speed = 0; }
      }

      // Lap & progress tracking
      for (let c of allCars) {
        let frontX = c.x + Math.cos(c.angle) * CAR_HL;
        let frontY = c.y + Math.sin(c.angle) * CAR_HL;
        let st = getCarState(frontX, frontY);
        if (raceState === 'racing') {
          if (c.prevIdx > trackPoints.length - 10 && st.idx < 10) c.laps++;
          if (c.prevIdx < 10 && st.idx > trackPoints.length - 10) c.laps = Math.max(0, c.laps - 1);
        }
        c.prevIdx = st.idx;
        c.progress = c.laps * TARGET_TRACK_LENGTH + trackCumDist[st.idx] + st.distAlong;
      }

      // High-score: submit when player completes a new lap
      if (raceState === 'racing' && playerCar.laps > prevPlayerLaps) {
        const isRecord = Store.scores.submit('Iso Racer', playerCar.laps);
        if (isRecord) isNewRecordFlash = 60;
        prevPlayerLaps = playerCar.laps;
      }
      if (isNewRecordFlash > 0) isNewRecordFlash--;

      // Leaderboard sort
      let racers = [];
      for (let c of allCars) racers.push({ car: c });
      racers.sort((a, b) => b.car.progress - a.car.progress);
      let lbBaseY = H - 130 + 40;
      racers.forEach((r, i) => {
        let targetY = lbBaseY + i * 24;
        if (r.car.lbY === undefined) r.car.lbY = targetY;
        else r.car.lbY += (targetY - r.car.lbY) * 0.15;
      });

      // Checkpoint tracking
      let pFrontX = playerCar.x + Math.cos(playerCar.angle) * CAR_HL;
      let pFrontY = playerCar.y + Math.sin(playerCar.angle) * CAR_HL;
      let pTrackState = getCarState(pFrontX, pFrontY);
      let cpIdx = Math.floor(pTrackState.idx / (trackPoints.length / checkpoints.length)) + 1;
      nextCheckpoint = cpIdx % checkpoints.length;

      let elapsedTime = gameStartTime ? (Date.now() - gameStartTime) / 1000 : 0;
      let mins = Math.floor(elapsedTime / 60);
      let secs = Math.floor(elapsedTime % 60);
      let ms   = Math.floor((elapsedTime % 1) * 1000);
      let timeStr = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`;

      // Camera
      if (cameraMode === 0) {
        camTarget[0] += (playerCar.x - camTarget[0]) * 0.08;
        camTarget[1] += (playerCar.y - camTarget[1]) * 0.08;
        camTarget[2] = 0;
        let dist = 1000;
        camPos[0] = camTarget[0] + dist;
        camPos[1] = camTarget[1] + dist;
        camPos[2] = dist * 0.8;
        camUp = [0, 0, 1];
        mat4.lookAt(viewMatrix, camPos, camTarget, camUp);
        let zoom = 2.5;
        let halfW = W / 2 / zoom;
        let halfH = H / 2 / zoom;
        mat4.ortho(projMatrix, -halfW, halfW, -halfH, halfH, 1, 10000);
        projMatrix[0] *= -1;
      } else {
        let speedRatio = Math.min(playerCar.speed / MAX_SPEED_ON_ROAD, 1.0);
        let dist = 45 + speedRatio * 35;
        let height = 25;
        let lookAhead = 30;
        camPos[0] = playerCar.x - Math.cos(playerCar.angle) * dist;
        camPos[1] = playerCar.y - Math.sin(playerCar.angle) * dist;
        camPos[2] = height;
        camTarget[0] = playerCar.x + Math.cos(playerCar.angle) * lookAhead;
        camTarget[1] = playerCar.y + Math.sin(playerCar.angle) * lookAhead;
        camTarget[2] = 2;
        camUp = [0, 0, 1];
        let aspect = W / H;
        mat4.perspective(projMatrix, Math.PI / 3, aspect, 1, 10000);
        projMatrix[0] *= -1;
        mat4.lookAt(viewMatrix, camPos, camTarget, camUp);
      }

      // Camera forward (culling)
      let cdx = camTarget[0] - camPos[0];
      let cdy = camTarget[1] - camPos[1];
      let cdz = camTarget[2] - camPos[2];
      let camFwdLen = Math.hypot(cdx, cdy, cdz);
      if (camFwdLen > 0) {
        camFwdX = cdx / camFwdLen; camFwdY = cdy / camFwdLen; camFwdZ = cdz / camFwdLen;
      }

      // WebGL render (to offscreen glCanvas)
      gl.viewport(0, 0, W, H);
      gl.clearColor(0.529, 0.807, 0.921, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      webGLVertexCount = 0;

      // Ground grid
      let gridRadius = 2000;
      let worldLeft = playerCar.x - gridRadius, worldRight = playerCar.x + gridRadius;
      let worldTop = playerCar.y - gridRadius, worldBottom = playerCar.y + gridRadius;
      let gridScale = 200;
      let startX = Math.floor(worldLeft / gridScale), endX = Math.ceil(worldRight / gridScale);
      let startY = Math.floor(worldTop / gridScale),  endY = Math.ceil(worldBottom / gridScale);
      for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
          addWebGLFace([
            [x*gridScale, y*gridScale, -1],
            [(x+1)*gridScale, y*gridScale, -1],
            [(x+1)*gridScale, (y+1)*gridScale, -1],
            [x*gridScale, (y+1)*gridScale, -1]
          ], ((x+y)%2===0) ? '#2d5a2d' : '#267726');
        }
      }

      // Road surface
      let roadPathL = [], roadPathR = [];
      for (let i = 0; i < trackPoints.length; i++) {
        let p = trackPoints[i], n = vertNorms[i];
        roadPathL.push({ x: p.x + n.x*trackWidth/2, y: p.y + n.y*trackWidth/2 });
        roadPathR.push({ x: p.x - n.x*trackWidth/2, y: p.y - n.y*trackWidth/2 });
      }
      for (let i = 0; i < trackPoints.length; i++) {
        let i0 = i, i1 = (i+1) % trackPoints.length;
        let p0 = roadPathL[i0], p1 = roadPathR[i0], p2 = roadPathR[i1], p3 = roadPathL[i1];
        addWebGLFace([[p0.x,p0.y,0],[p1.x,p1.y,0],[p2.x,p2.y,0],[p3.x,p3.y,0]], '#303030');
      }

      // Edge lines
      for (let i = 0; i < trackPoints.length; i++) {
        let i0 = i, i1 = (i+1) % trackPoints.length;
        let p0 = roadPathL[i0], p1 = roadPathL[i1];
        let n0 = vertNorms[i0], n1 = vertNorms[i1];
        let lineW = 2;
        let p0i = { x: p0.x - n0.x*lineW, y: p0.y - n0.y*lineW };
        let p1i = { x: p1.x - n1.x*lineW, y: p1.y - n1.y*lineW };
        addWebGLFace([[p0.x,p0.y,0.1],[p0i.x,p0i.y,0.1],[p1i.x,p1i.y,0.1],[p1.x,p1.y,0.1]], '#ffffff');
        p0 = roadPathR[i0]; p1 = roadPathR[i1];
        let p0o = { x: p0.x + n0.x*lineW, y: p0.y + n0.y*lineW };
        let p1o = { x: p1.x + n1.x*lineW, y: p1.y + n1.y*lineW };
        addWebGLFace([[p0.x,p0.y,0.1],[p1.x,p1.y,0.1],[p1o.x,p1o.y,0.1],[p0o.x,p0o.y,0.1]], '#ffffff');
      }

      // Kerbs
      for (let i = 0; i < roadQuads.length; i++) {
        if (kerbSides[i] === 0) continue;
        let int0 = kerbIntensity[i], int1 = kerbIntensity[(i+1)%roadQuads.length];
        if (int0 < 0.01 && int1 < 0.01) continue;
        let p0 = trackPoints[i], p1 = trackPoints[(i+1)%trackPoints.length];
        let vNorm0 = vertNorms[i], vNorm1 = vertNorms[(i+1)%trackPoints.length];
        let color = (Math.floor(i/2)%2===0) ? '#cc0000' : '#ffffff';
        if (kerbSides[i] === 1) {
          let off0 = trackWidth/2 + 2 + 14*int0, off1 = trackWidth/2 + 2 + 14*int1;
          addWebGLFace(
            [[p0.x + vNorm0.x*off0, p0.y + vNorm0.y*off0, 0.2],
             [p1.x + vNorm1.x*off1, p1.y + vNorm1.y*off1, 0.2],
             [p1.x + vNorm1.x*(trackWidth/2+2), p1.y + vNorm1.y*(trackWidth/2+2), 0.2],
             [p0.x + vNorm0.x*(trackWidth/2+2), p0.y + vNorm0.y*(trackWidth/2+2), 0.2]], color);
        } else if (kerbSides[i] === -1) {
          let off0 = trackWidth/2 + 2 + 14*int0, off1 = trackWidth/2 + 2 + 14*int1;
          addWebGLFace(
            [[p0.x - vNorm0.x*off0, p0.y - vNorm0.y*off0, 0.2],
             [p1.x - vNorm1.x*off1, p1.y - vNorm1.y*off1, 0.2],
             [p1.x - vNorm1.x*(trackWidth/2+2), p1.y - vNorm1.y*(trackWidth/2+2), 0.2],
             [p0.x - vNorm0.x*(trackWidth/2+2), p0.y - vNorm0.y*(trackWidth/2+2), 0.2]], color);
        }
      }

      // Start finish stripe
      let p0_sf = trackPoints[0], p1_sf = trackPoints[1];
      let dx_sf = p1_sf.x - p0_sf.x, dy_sf = p1_sf.y - p0_sf.y, len_sf = Math.sqrt(dx_sf*dx_sf + dy_sf*dy_sf);
      let fx_sf = dx_sf/len_sf, fy_sf = dy_sf/len_sf, nx_sf = -fy_sf, ny_sf = fx_sf;
      let tw_sf = trackWidth;
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 2; j++) {
          let color = ((i+j)%2===0) ? '#fff' : '#000';
          let startN = -tw_sf/2 + i*(tw_sf/10), startF = j*15;
          addWebGLFace(
            [[p0_sf.x + fx_sf*startF + nx_sf*startN, p0_sf.y + fy_sf*startF + ny_sf*startN, 0.3],
             [p0_sf.x + fx_sf*startF + nx_sf*(startN + tw_sf/10), p0_sf.y + fy_sf*startF + ny_sf*(startN + tw_sf/10), 0.3],
             [p0_sf.x + fx_sf*(startF+15) + nx_sf*(startN + tw_sf/10), p0_sf.y + fy_sf*(startF+15) + ny_sf*(startN + tw_sf/10), 0.3],
             [p0_sf.x + fx_sf*(startF+15) + nx_sf*startN, p0_sf.y + fy_sf*(startF+15) + ny_sf*startN, 0.3]], color);
        }
      }

      function addWallFaces(path) {
        let step = 2;
        let pathNorms = [];
        for (let i = 0; i < path.length; i++) {
          let p0 = path[(i-1+path.length)%path.length];
          let p1 = path[(i+1)%path.length];
          let dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy);
          if (len > 0) pathNorms.push({ x: -dy/len, y: dx/len });
          else pathNorms.push({ x: 0, y: 0 });
        }
        for (let i = 0; i < path.length; i += step) {
          let p0 = path[i], p1 = path[(i+step)%path.length];
          let n0 = pathNorms[i], n1 = pathNorms[(i+step)%path.length];
          let ht = 3;
          let o0 = { x: p0.x + n0.x*ht, y: p0.y + n0.y*ht };
          let o1 = { x: p1.x + n1.x*ht, y: p1.y + n1.y*ht };
          let i0 = { x: p0.x - n0.x*ht, y: p0.y - n0.y*ht };
          let i1 = { x: p1.x - n1.x*ht, y: p1.y - n1.y*ht };
          drawGuardrailSeg(o0, o1, i0, i1);
        }
      }
      let boundaryOffset = trackWidth/2 + 115;
      addWallFaces(trackPoints.map(p => {
        let vx = p.x - trackCenterX, vy = p.y - trackCenterY, d = Math.hypot(vx, vy);
        if (d === 0) return { x: p.x, y: p.y };
        return { x: p.x + (vx/d)*boundaryOffset, y: p.y + (vy/d)*boundaryOffset };
      }));
      addWallFaces(trackPoints.map(p => {
        let vx = p.x - trackCenterX, vy = p.y - trackCenterY, d = Math.hypot(vx, vy);
        if (d === 0) return { x: p.x, y: p.y };
        return { x: p.x - (vx/d)*boundaryOffset, y: p.y - (vy/d)*boundaryOffset };
      }));

      // Grandstands (culled)
      for (let block of grandstandBlocks) {
        let cx = (block.b0.x + block.b1.x + block.b2.x + block.b3.x) / 4;
        let cy = (block.b0.y + block.b1.y + block.b2.y + block.b3.y) / 4;
        let cz = (block.z0 + block.z1) / 2;
        let dx = cx - camPos[0], dy = cy - camPos[1], dz = cz - camPos[2];
        let distToCam = Math.hypot(dx, dy, dz);
        let dot = dx*camFwdX + dy*camFwdY + dz*camFwdZ;
        if (dot > -200 && distToCam < 3000) {
          drawBox3D(block.b0, block.b1, block.b2, block.b3, block.z0, block.z1, block.colorBase);
        }
      }

      // Crowd (culled)
      for (let p of crowdPeople) {
        let cx = p.x, cy = p.y, cz = p.z_base + p.h/2;
        let dx = cx - camPos[0], dy = cy - camPos[1], dz = cz - camPos[2];
        let distToCam = Math.hypot(dx, dy, dz);
        let dot = dx*camFwdX + dy*camFwdY + dz*camFwdZ;
        if (dot > 0 && distToCam < 2500) {
          let pDistToPlayer = Math.hypot(playerCar.x - p.x, playerCar.y - p.y);
          let minCarDist = pDistToPlayer;
          for (let bot of bots) {
            let d = Math.hypot(bot.x - p.x, bot.y - p.y);
            if (d < minCarDist) minCarDist = d;
          }
          let jumpZ = 0, maxDist = 500;
          if (minCarDist < maxDist && raceState === 'racing') {
            let intensity = 1 - (minCarDist / maxDist);
            jumpZ = Math.max(0, Math.sin(tickCount * 0.25 + p.phase)) * intensity * 6.0;
          }
          let toCenterX = trackCenterX - p.x, toCenterY = trackCenterY - p.y;
          let len = Math.hypot(toCenterX, toCenterY);
          let fwdX = toCenterX / len, fwdY = toCenterY / len, sideX = -fwdY, sideY = fwdX;
          let hw = p.w/2, hd = p.d/2;
          drawBox3D(
            { x: p.x - sideX*hw + fwdX*hd, y: p.y - sideY*hw + fwdY*hd },
            { x: p.x + sideX*hw + fwdX*hd, y: p.y + sideY*hw + fwdY*hd },
            { x: p.x + sideX*hw - fwdX*hd, y: p.y + sideY*hw - fwdY*hd },
            { x: p.x - sideX*hw - fwdX*hd, y: p.y - sideY*hw - fwdY*hd },
            p.z_base + jumpZ, p.z_base + jumpZ + p.h, p.color);
        }
      }

      // Cars
      for (let ac of allCars) drawVehicle(ac.x, ac.y, ac.angle, ac.color);

      gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);
      gl.uniformMatrix4fv(uProjLoc, false, projMatrix);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, webGLVertices.subarray(0, webGLVertexCount));
      gl.drawArrays(gl.TRIANGLES, 0, Math.floor(webGLVertexCount / 7));
      gl.flush();

      // Copy WebGL canvas to Main Canvas
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(glCanvas, 0, 0, W, H);

      // 2D HUD
      if (debugViz) drawHitboxes();

      const bestLaps = Store.scores.get('Iso Racer');

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('LAP: ' + playerCar.laps, 20, 30);
      ctx.fillText('TIME: ' + timeStr, 20, 55);
      ctx.fillText('SPEED: ' + (Math.hypot(playerCar.vx, playerCar.vy) * 10).toFixed(0) + ' km/h', 20, 80);
      ctx.fillText('CAM: ' + (cameraMode === 0 ? 'Isometric' : 'Chase'), 20, 105);
      ctx.fillText('BEST LAPS: ' + bestLaps, 20, 130);

      if (isNewRecordFlash > 0 && (isNewRecordFlash % 10 < 5)) {
        ctx.fillStyle = '#ff0';
        ctx.fillText('NEW RECORD!', 20, 155);
      }

      let trackState2 = getCarState(playerCar.x, playerCar.y);
      if (trackState2.offRoad && Math.hypot(playerCar.vx, playerCar.vy) > 0.5) {
        ctx.fillStyle = '#ff0'; ctx.fillText('! OFF-ROAD !', 20, 175);
      }
      let lat = -playerCar.vx * Math.sin(playerCar.angle) + playerCar.vy * Math.cos(playerCar.angle);
      let isDrifting = Math.abs(lat) > 1.5 && Math.hypot(playerCar.vx, playerCar.vy) > 3;
      if (isDrifting || (Hub.keys[KEYS.handbrake] && raceState === 'racing')) {
        ctx.fillStyle = '#0ff'; ctx.fillText('! DRIFTING !', 20, 195);
      }

      // Helper text using prettyKey for rebound keys
      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      const hintLine =
        '[' + Utils.prettyKey(KEYS.select)    + '] Pause/Change Car  ' +
        '[' + Utils.prettyKey(KEYS.camera)    + '] Camera  ' +
        '[' + Utils.prettyKey(KEYS.debug)     + '] Debug  ' +
        '[' + Utils.prettyKey(KEYS.restart)   + '] Restart';
      ctx.fillText(hintLine, 20, 215);
      ctx.font = 'bold 16px monospace';

      if (debugViz) {
        ctx.fillStyle = '#0ff';
        ctx.fillText('DEBUG VIZ: ON [' + Utils.prettyKey(KEYS.debug) + ' to toggle]', 20, 235);
      }

      drawLeaderboard(racers);
      drawMinimap();

      // Countdown / selection overlays
      if (raceState === 'selection' || raceState === 'countdown') {
        let bounce = Math.abs(Math.sin(tickCount * 0.1)) * 8;
        let triCenter = project3D(playerCar.x, playerCar.y, 40 + bounce);
        if (triCenter.visible) {
          ctx.fillStyle = playerCar.color;
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(triCenter.sx, triCenter.sy);
          ctx.lineTo(triCenter.sx - 15, triCenter.sy - 25);
          ctx.lineTo(triCenter.sx + 15, triCenter.sy - 25);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }

        if (raceState === 'selection') {
          ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
          ctx.fillText('COUNTDOWN PAUSED', W/2, H/2 - 40);
          ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#0ff';
          ctx.fillText(
            '[' + Utils.prettyKey(KEYS.select)    + '] Change Car  |  ' +
            '[' + Utils.prettyKey(KEYS.handbrake) + '] Resume',
            W/2, H/2 + 10
          );
        } else {
          let displayNum = Math.ceil(countdownTimer);
          if (displayNum > 0) {
            let timeInSecond = 1.0 - (countdownTimer - Math.floor(countdownTimer));
            let alpha = 1.0 - (timeInSecond * 0.5);
            ctx.font = `bold ${80 + timeInSecond*40}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fillText(displayNum.toString(), W/2, H/2);
          } else {
            let timeInGo = Math.abs(countdownTimer);
            let alpha = 1.0 - (timeInGo * 2);
            ctx.font = `bold ${120 - timeInGo*20}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(0,255,0,${alpha})`;
            ctx.fillText('GO!', W/2, H/2);
          }
        }
        ctx.textAlign = 'left';
      }
    },
    destroy() { 
      c.remove(); 
    }
  };
} },{ name: "Snake IO", icon: "data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%201000%201000%22%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20xml%3Aspace%3D%22preserve%22%20xmlns%3Aserif%3D%22http%3A%2F%2Fwww.serif.com%2F%22%20style%3D%22fill-rule%3Aevenodd%3Bclip-rule%3Aevenodd%3B%22%3E%0A%20%20%20%20%3Cg%20transform%3D%22matrix(0.789307%2C0%2C0%2C0.897596%2C2305.844664%2C265.811526)%22%3E%0A%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(1.797671%2C0%2C0%2C1.580793%2C-2163.951138%2C260.906203)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3CclipPath%20id%3D%22_clip1%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%22-421.324%22%20y%3D%22-352.382%22%20width%3D%22704.764%22%20height%3D%22704.764%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2FclipPath%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20clip-path%3D%22url(%23_clip1)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(1%2C0%2C0%2C1%2C-540%2C-540)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3CclipPath%20id%3D%22_clip2%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%221080%22%20height%3D%221080%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2FclipPath%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20clip-path%3D%22url(%23_clip2)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20x%3D%2256.622%22%20y%3D%22-248.504%22%20width%3D%22360%22%20height%3D%22360%22%20style%3D%22fill%3Argb(24%2C27%2C34)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(2.12132%2C2.12132%2C-2.12132%2C2.12132%2C-107.269304%2C183.368561)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M-230%2C-594.67L-170%2C-594.67L-200%2C-542.71L-230%2C-594.67ZM-130%2C-594.67L-70%2C-594.67L-100%2C-542.71L-130%2C-594.67ZM-30%2C-594.67L30%2C-594.67L0%2C-542.71L-30%2C-594.67ZM70%2C-594.67L130%2C-594.67L100%2C-542.71L70%2C-594.67ZM170%2C-594.67L230%2C-594.67L200%2C-542.71L170%2C-594.67ZM270%2C-594.67L330%2C-594.67L300%2C-542.71L270%2C-594.67ZM370%2C-594.67L430%2C-594.67L400%2C-542.71L370%2C-594.67ZM470%2C-594.67L530%2C-594.67L500%2C-542.71L470%2C-594.67ZM-280%2C-531.16L-220%2C-531.16L-250%2C-583.12L-280%2C-531.16ZM-180%2C-531.16L-120%2C-531.16L-150%2C-583.12L-180%2C-531.16ZM-80%2C-531.16L-20%2C-531.16L-50%2C-583.12L-80%2C-531.16ZM20%2C-531.16L80%2C-531.16L50%2C-583.12L20%2C-531.16ZM120%2C-531.16L180%2C-531.16L150%2C-583.12L120%2C-531.16ZM220%2C-531.16L280%2C-531.16L250%2C-583.12L220%2C-531.16ZM320%2C-531.16L380%2C-531.16L350%2C-583.12L320%2C-531.16ZM420%2C-531.16L480%2C-531.16L450%2C-583.12L420%2C-531.16ZM-280%2C-508.07L-220%2C-508.07L-250%2C-456.11L-280%2C-508.07ZM-180%2C-508.07L-120%2C-508.07L-150%2C-456.11L-180%2C-508.07ZM-80%2C-508.07L-20%2C-508.07L-50%2C-456.11L-80%2C-508.07ZM20%2C-508.07L80%2C-508.07L50%2C-456.11L20%2C-508.07ZM120%2C-508.07L180%2C-508.07L150%2C-456.11L120%2C-508.07ZM220%2C-508.07L280%2C-508.07L250%2C-456.11L220%2C-508.07ZM320%2C-508.07L380%2C-508.07L350%2C-456.11L320%2C-508.07ZM420%2C-508.07L480%2C-508.07L450%2C-456.11L420%2C-508.07ZM-230%2C-444.56L-170%2C-444.56L-200%2C-496.52L-230%2C-444.56ZM-130%2C-444.56L-70%2C-444.56L-100%2C-496.52L-130%2C-444.56ZM-30%2C-444.56L30%2C-444.56L0%2C-496.52L-30%2C-444.56ZM70%2C-444.56L130%2C-444.56L100%2C-496.52L70%2C-444.56ZM170%2C-444.56L230%2C-444.56L200%2C-496.52L170%2C-444.56ZM270%2C-444.56L330%2C-444.56L300%2C-496.52L270%2C-444.56ZM370%2C-444.56L430%2C-444.56L400%2C-496.52L370%2C-444.56ZM470%2C-444.56L530%2C-444.56L500%2C-496.52L470%2C-444.56ZM-230%2C-421.47L-170%2C-421.47L-200%2C-369.5L-230%2C-421.47ZM-130%2C-421.47L-70%2C-421.47L-100%2C-369.5L-130%2C-421.47ZM-30%2C-421.47L30%2C-421.47L0%2C-369.5L-30%2C-421.47ZM70%2C-421.47L130%2C-421.47L100%2C-369.5L70%2C-421.47ZM170%2C-421.47L230%2C-421.47L200%2C-369.5L170%2C-421.47ZM270%2C-421.47L330%2C-421.47L300%2C-369.5L270%2C-421.47ZM370%2C-421.47L430%2C-421.47L400%2C-369.5L370%2C-421.47ZM470%2C-421.47L530%2C-421.47L500%2C-369.5L470%2C-421.47ZM-280%2C-357.96L-220%2C-357.96L-250%2C-409.92L-280%2C-357.96ZM-180%2C-357.96L-120%2C-357.96L-150%2C-409.92L-180%2C-357.96ZM-80%2C-357.96L-20%2C-357.96L-50%2C-409.92L-80%2C-357.96ZM20%2C-357.96L80%2C-357.96L50%2C-409.92L20%2C-357.96ZM120%2C-357.96L180%2C-357.96L150%2C-409.92L120%2C-357.96ZM220%2C-357.96L280%2C-357.96L250%2C-409.92L220%2C-357.96ZM320%2C-357.96L380%2C-357.96L350%2C-409.92L320%2C-357.96ZM420%2C-357.96L480%2C-357.96L450%2C-409.92L420%2C-357.96ZM-280%2C-334.86L-220%2C-334.86L-250%2C-282.9L-280%2C-334.86ZM-180%2C-334.86L-120%2C-334.86L-150%2C-282.9L-180%2C-334.86ZM-80%2C-334.86L-20%2C-334.86L-50%2C-282.9L-80%2C-334.86ZM20%2C-334.86L80%2C-334.86L50%2C-282.9L20%2C-334.86ZM120%2C-334.86L180%2C-334.86L150%2C-282.9L120%2C-334.86ZM220%2C-334.86L280%2C-334.86L250%2C-282.9L220%2C-334.86ZM320%2C-334.86L380%2C-334.86L350%2C-282.9L320%2C-334.86ZM420%2C-334.86L480%2C-334.86L450%2C-282.9L420%2C-334.86ZM-230%2C-271.35L-170%2C-271.35L-200%2C-323.32L-230%2C-271.35ZM-130%2C-271.35L-70%2C-271.35L-100%2C-323.32L-130%2C-271.35ZM-30%2C-271.35L30%2C-271.35L0%2C-323.32L-30%2C-271.35ZM70%2C-271.35L130%2C-271.35L100%2C-323.32L70%2C-271.35ZM170%2C-271.35L230%2C-271.35L200%2C-323.32L170%2C-271.35ZM270%2C-271.35L330%2C-271.35L300%2C-323.32L270%2C-271.35ZM370%2C-271.35L430%2C-271.35L400%2C-323.32L370%2C-271.35ZM470%2C-271.35L530%2C-271.35L500%2C-323.32L470%2C-271.35ZM-230%2C-248.26L-170%2C-248.26L-200%2C-196.3L-230%2C-248.26ZM-130%2C-248.26L-70%2C-248.26L-100%2C-196.3L-130%2C-248.26ZM-30%2C-248.26L30%2C-248.26L0%2C-196.3L-30%2C-248.26ZM70%2C-248.26L130%2C-248.26L100%2C-196.3L70%2C-248.26ZM170%2C-248.26L230%2C-248.26L200%2C-196.3L170%2C-248.26ZM270%2C-248.26L330%2C-248.26L300%2C-196.3L270%2C-248.26ZM370%2C-248.26L430%2C-248.26L400%2C-196.3L370%2C-248.26ZM470%2C-248.26L530%2C-248.26L500%2C-196.3L470%2C-248.26ZM-280%2C-184.75L-220%2C-184.75L-250%2C-236.71L-280%2C-184.75ZM-180%2C-184.75L-120%2C-184.75L-150%2C-236.71L-180%2C-184.75ZM-80%2C-184.75L-20%2C-184.75L-50%2C-236.71L-80%2C-184.75ZM20%2C-184.75L80%2C-184.75L50%2C-236.71L20%2C-184.75ZM120%2C-184.75L180%2C-184.75L150%2C-236.71L120%2C-184.75ZM220%2C-184.75L280%2C-184.75L250%2C-236.71L220%2C-184.75ZM320%2C-184.75L380%2C-184.75L350%2C-236.71L320%2C-184.75ZM420%2C-184.75L480%2C-184.75L450%2C-236.71L420%2C-184.75ZM-280%2C-161.66L-220%2C-161.66L-250%2C-109.7L-280%2C-161.66ZM-180%2C-161.66L-120%2C-161.66L-150%2C-109.7L-180%2C-161.66ZM-80%2C-161.66L-20%2C-161.66L-50%2C-109.7L-80%2C-161.66ZM20%2C-161.66L80%2C-161.66L50%2C-109.7L20%2C-161.66ZM120%2C-161.66L180%2C-161.66L150%2C-109.7L120%2C-161.66ZM220%2C-161.66L280%2C-161.66L250%2C-109.7L220%2C-161.66ZM320%2C-161.66L380%2C-161.66L350%2C-109.7L320%2C-161.66ZM420%2C-161.66L480%2C-161.66L450%2C-109.7L420%2C-161.66ZM-230%2C-98.15L-170%2C-98.15L-200%2C-150.11L-230%2C-98.15ZM-130%2C-98.15L-70%2C-98.15L-100%2C-150.11L-130%2C-98.15ZM-30%2C-98.15L30%2C-98.15L0%2C-150.11L-30%2C-98.15ZM70%2C-98.15L130%2C-98.15L100%2C-150.11L70%2C-98.15ZM170%2C-98.15L230%2C-98.15L200%2C-150.11L170%2C-98.15ZM270%2C-98.15L330%2C-98.15L300%2C-150.11L270%2C-98.15ZM370%2C-98.15L430%2C-98.15L400%2C-150.11L370%2C-98.15ZM470%2C-98.15L530%2C-98.15L500%2C-150.11L470%2C-98.15ZM-230%2C-75.06L-170%2C-75.06L-200%2C-23.09L-230%2C-75.06ZM-130%2C-75.06L-70%2C-75.06L-100%2C-23.09L-130%2C-75.06ZM-30%2C-75.06L30%2C-75.06L0%2C-23.09L-30%2C-75.06ZM70%2C-75.06L130%2C-75.06L100%2C-23.09L70%2C-75.06ZM170%2C-75.06L230%2C-75.06L200%2C-23.09L170%2C-75.06ZM270%2C-75.06L330%2C-75.06L300%2C-23.09L270%2C-75.06ZM370%2C-75.06L430%2C-75.06L400%2C-23.09L370%2C-75.06ZM470%2C-75.06L530%2C-75.06L500%2C-23.09L470%2C-75.06ZM-280%2C-11.55L-220%2C-11.55L-250%2C-63.51L-280%2C-11.55ZM-180%2C-11.55L-120%2C-11.55L-150%2C-63.51L-180%2C-11.55ZM-80%2C-11.55L-20%2C-11.55L-50%2C-63.51L-80%2C-11.55ZM20%2C-11.55L80%2C-11.55L50%2C-63.51L20%2C-11.55ZM120%2C-11.55L180%2C-11.55L150%2C-63.51L120%2C-11.55ZM220%2C-11.55L280%2C-11.55L250%2C-63.51L220%2C-11.55ZM320%2C-11.55L380%2C-11.55L350%2C-63.51L320%2C-11.55ZM420%2C-11.55L480%2C-11.55L450%2C-63.51L420%2C-11.55ZM-280%2C11.55L-220%2C11.55L-250%2C63.51L-280%2C11.55ZM-180%2C11.55L-120%2C11.55L-150%2C63.51L-180%2C11.55ZM-80%2C11.55L-20%2C11.55L-50%2C63.51L-80%2C11.55ZM20%2C11.55L80%2C11.55L50%2C63.51L20%2C11.55ZM120%2C11.55L180%2C11.55L150%2C63.51L120%2C11.55ZM220%2C11.55L280%2C11.55L250%2C63.51L220%2C11.55ZM320%2C11.55L380%2C11.55L350%2C63.51L320%2C11.55ZM420%2C11.55L480%2C11.55L450%2C63.51L420%2C11.55ZM-230%2C75.06L-170%2C75.06L-200%2C23.09L-230%2C75.06ZM-130%2C75.06L-70%2C75.06L-100%2C23.09L-130%2C75.06ZM-30%2C75.06L30%2C75.06L0%2C23.09L-30%2C75.06ZM70%2C75.06L130%2C75.06L100%2C23.09L70%2C75.06ZM170%2C75.06L230%2C75.06L200%2C23.09L170%2C75.06ZM270%2C75.06L330%2C75.06L300%2C23.09L270%2C75.06ZM370%2C75.06L430%2C75.06L400%2C23.09L370%2C75.06ZM470%2C75.06L530%2C75.06L500%2C23.09L470%2C75.06ZM-230%2C98.15L-170%2C98.15L-200%2C150.11L-230%2C98.15ZM-130%2C98.15L-70%2C98.15L-100%2C150.11L-130%2C98.15ZM-30%2C98.15L30%2C98.15L0%2C150.11L-30%2C98.15ZM70%2C98.15L130%2C98.15L100%2C150.11L70%2C98.15ZM170%2C98.15L230%2C98.15L200%2C150.11L170%2C98.15ZM270%2C98.15L330%2C98.15L300%2C150.11L270%2C98.15ZM370%2C98.15L430%2C98.15L400%2C150.11L370%2C98.15ZM470%2C98.15L530%2C98.15L500%2C150.11L470%2C98.15ZM-280%2C161.66L-220%2C161.66L-250%2C109.7L-280%2C161.66ZM-180%2C161.66L-120%2C161.66L-150%2C109.7L-180%2C161.66ZM-80%2C161.66L-20%2C161.66L-50%2C109.7L-80%2C161.66ZM20%2C161.66L80%2C161.66L50%2C109.7L20%2C161.66ZM120%2C161.66L180%2C161.66L150%2C109.7L120%2C161.66ZM220%2C161.66L280%2C161.66L250%2C109.7L220%2C161.66ZM320%2C161.66L380%2C161.66L350%2C109.7L320%2C161.66ZM420%2C161.66L480%2C161.66L450%2C109.7L420%2C161.66Z%22%20style%3D%22fill%3Argb(33%2C39%2C47)%3Bfill-rule%3Anonzero%3Bstroke%3Argb(8%2C13%2C16)%3Bstroke-width%3A2.33px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%220%22%20r%3D%221500%22%20style%3D%22fill%3Anone%3Bstroke%3Argb(255%2C80%2C80)%3Bstroke-opacity%3A0.4%3Bstroke-width%3A2.67px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%220%22%20r%3D%221500%22%20style%3D%22fill%3Anone%3Bstroke%3Argb(255%2C68%2C68)%3Bstroke-width%3A0.67px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M70.66%2C8.57L70.71%2C4.47L70.64%2C0.41L70.49%2C-3.62L70.3%2C-7.62L70.11%2C-11.63L69.96%2C-15.66L69.89%2C-19.71L69.91%2C-21.41%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C73%2C91)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M69.91%2C-21.41L69.94%2C-23.82L70.15%2C-28L70.56%2C-32.25L71.21%2C-36.61L72.14%2C-41.09L72.96%2C-44.56L73.8%2C-48.16L74.46%2C-50.97%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(85%2C41%2C0)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M74.46%2C-50.97L74.67%2C-51.86L75.59%2C-55.65L76.58%2C-59.5L77.65%2C-63.39L78.82%2C-67.31L80.12%2C-71.24L81.54%2C-75.14L83.12%2C-79.02L83.38%2C-79.57%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C73%2C91)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M83.38%2C-79.57L84.87%2C-82.83L86.8%2C-86.57L88.94%2C-90.22L91.29%2C-93.75L93.88%2C-97.15L96.72%2C-100.39L99.22%2C-102.92L100.4%2C-104%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(85%2C41%2C0)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M100.4%2C-104L101.97%2C-105.45L104.94%2C-107.99L108.11%2C-110.51L111.45%2C-113.02L114.95%2C-115.49L118.58%2C-117.93L122.31%2C-120.32L124.56%2C-121.7%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C73%2C91)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M124.56%2C-121.7L126.13%2C-122.66L130.01%2C-124.93L133.92%2C-127.12L137.86%2C-129.23L141.79%2C-131.25L145.69%2C-133.17L149.54%2C-134.98L151.08%2C-135.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(85%2C41%2C0)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M151.08%2C-135.67L153.32%2C-136.67L157%2C-138.23L160.56%2C-139.65L163.98%2C-140.93L167.23%2C-142.05L171.73%2C-143.37L176.16%2C-144.37L179.52%2C-144.91%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C73%2C91)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M179.52%2C-144.91L180.53%2C-145.08L184.84%2C-145.53L189.07%2C-145.74L193.23%2C-145.75L197.32%2C-145.59L201.31%2C-145.29L205.22%2C-144.87L209.04%2C-144.36L209.4%2C-144.3%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(85%2C41%2C0)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M209.4%2C-144.3L212.77%2C-143.79L216.39%2C-143.2L219.91%2C-142.61L223.32%2C-142.05L227.85%2C-141.16L232.07%2C-140.02L236.04%2C-138.67L238.56%2C-137.65%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C73%2C91)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M238.56%2C-137.65L239.8%2C-137.15L243.42%2C-135.51L246.95%2C-133.8L250.45%2C-132.05L253.96%2C-130.33L257.54%2C-128.66L261.25%2C-127.1%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(85%2C41%2C0)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M70.66%2C8.57L70.71%2C4.47L70.64%2C0.41L70.49%2C-3.62L70.3%2C-7.62L70.11%2C-11.63L69.96%2C-15.66L69.89%2C-19.71L69.91%2C-21.41%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C184%2C229)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M69.91%2C-21.41L69.94%2C-23.82L70.15%2C-28L70.56%2C-32.25L71.21%2C-36.61L72.14%2C-41.09L72.96%2C-44.56L73.8%2C-48.16L74.46%2C-50.97%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(214%2C104%2C0)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M74.46%2C-50.97L74.67%2C-51.86L75.59%2C-55.65L76.58%2C-59.5L77.65%2C-63.39L78.82%2C-67.31L80.12%2C-71.24L81.54%2C-75.14L83.12%2C-79.02L83.38%2C-79.57%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C184%2C229)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M83.38%2C-79.57L84.87%2C-82.83L86.8%2C-86.57L88.94%2C-90.22L91.29%2C-93.75L93.88%2C-97.15L96.72%2C-100.39L99.22%2C-102.92L100.4%2C-104%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(214%2C104%2C0)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M100.4%2C-104L101.97%2C-105.45L104.94%2C-107.99L108.11%2C-110.51L111.45%2C-113.02L114.95%2C-115.49L118.58%2C-117.93L122.31%2C-120.32L124.56%2C-121.7%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C184%2C229)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M124.56%2C-121.7L126.13%2C-122.66L130.01%2C-124.93L133.92%2C-127.12L137.86%2C-129.23L141.79%2C-131.25L145.69%2C-133.17L149.54%2C-134.98L151.08%2C-135.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(214%2C104%2C0)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M151.08%2C-135.67L153.32%2C-136.67L157%2C-138.23L160.56%2C-139.65L163.98%2C-140.93L167.23%2C-142.05L171.73%2C-143.37L176.16%2C-144.37L179.52%2C-144.91%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C184%2C229)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M179.52%2C-144.91L180.53%2C-145.08L184.84%2C-145.53L189.07%2C-145.74L193.23%2C-145.75L197.32%2C-145.59L201.31%2C-145.29L205.22%2C-144.87L209.04%2C-144.36L209.4%2C-144.3%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(214%2C104%2C0)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M209.4%2C-144.3L212.77%2C-143.79L216.39%2C-143.2L219.91%2C-142.61L223.32%2C-142.05L227.85%2C-141.16L232.07%2C-140.02L236.04%2C-138.67L238.56%2C-137.65%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C184%2C229)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M238.56%2C-137.65L239.8%2C-137.15L243.42%2C-135.51L246.95%2C-133.8L250.45%2C-132.05L253.96%2C-130.33L257.54%2C-128.66L261.25%2C-127.1%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(214%2C104%2C0)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M74.46%2C-50.97L74.67%2C-51.86L75.59%2C-55.65L76.58%2C-59.5L77.65%2C-63.39L78.82%2C-67.31L80.12%2C-71.24L81.54%2C-75.14L83.12%2C-79.02L83.38%2C-79.57%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C239%2C255)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M83.38%2C-79.57L84.87%2C-82.83L86.8%2C-86.57L88.94%2C-90.22L91.29%2C-93.75L93.88%2C-97.15L96.72%2C-100.39L99.22%2C-102.92L100.4%2C-104%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(255%2C135%2C0)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M100.4%2C-104L101.97%2C-105.45L104.94%2C-107.99L108.11%2C-110.51L111.45%2C-113.02L114.95%2C-115.49L118.58%2C-117.93L122.31%2C-120.32L124.56%2C-121.7%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C239%2C255)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M124.56%2C-121.7L126.13%2C-122.66L130.01%2C-124.93L133.92%2C-127.12L137.86%2C-129.23L141.79%2C-131.25L145.69%2C-133.17L149.54%2C-134.98L151.08%2C-135.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(255%2C135%2C0)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M151.08%2C-135.67L153.32%2C-136.67L157%2C-138.23L160.56%2C-139.65L163.98%2C-140.93L167.23%2C-142.05L171.73%2C-143.37L176.16%2C-144.37L179.52%2C-144.91%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C239%2C255)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M179.52%2C-144.91L180.53%2C-145.08L184.84%2C-145.53L189.07%2C-145.74L193.23%2C-145.75L197.32%2C-145.59L201.31%2C-145.29L205.22%2C-144.87L209.04%2C-144.36L209.4%2C-144.3%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(255%2C135%2C0)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M209.4%2C-144.3L212.77%2C-143.79L216.39%2C-143.2L219.91%2C-142.61L223.32%2C-142.05L227.85%2C-141.16L232.07%2C-140.02L236.04%2C-138.67L238.56%2C-137.65%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C239%2C255)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M238.56%2C-137.65L239.8%2C-137.15L243.42%2C-135.51L246.95%2C-133.8L250.45%2C-132.05L253.96%2C-130.33L257.54%2C-128.66L261.25%2C-127.1%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(255%2C135%2C0)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22261.25%22%20cy%3D%22-127.1%22%20r%3D%2213.2%22%20style%3D%22fill%3Argb(0%2C202%2C251)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22261.25%22%20cy%3D%22-127.1%22%20r%3D%2210.2%22%20style%3D%22fill%3Argb(0%2C184%2C229)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22266.41%22%20cy%3D%22-128.7%22%20r%3D%224.2%22%20style%3D%22fill%3Awhite%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22263.71%22%20cy%3D%22-122.29%22%20r%3D%224.2%22%20style%3D%22fill%3Awhite%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22267.79%22%20cy%3D%22-128.12%22%20r%3D%222.4%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22265.09%22%20cy%3D%22-121.7%22%20r%3D%222.4%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M377.95%2C-133.18L377.33%2C-129.12L376.83%2C-125.09L376.42%2C-121.08L376.05%2C-117.09L375.68%2C-113.09L375.27%2C-109.09L374.78%2C-105.06L374.52%2C-103.38%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C92%2C1)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M374.52%2C-103.38L374.16%2C-101L373.37%2C-96.89L372.37%2C-92.73L371.12%2C-88.51L369.57%2C-84.2L368.28%2C-80.88L366.95%2C-77.43L365.9%2C-74.74%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(38%2C0%2C85)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M365.9%2C-74.74L365.57%2C-73.89L364.13%2C-70.27L362.62%2C-66.59L361.01%2C-62.88L359.31%2C-59.16L357.48%2C-55.46L355.52%2C-51.79L353.42%2C-48.17L353.09%2C-47.66%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C92%2C1)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M353.09%2C-47.66L351.16%2C-44.64L348.72%2C-41.2L346.1%2C-37.89L343.28%2C-34.72L340.25%2C-31.72L336.98%2C-28.9L334.15%2C-26.75L332.84%2C-25.84%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(38%2C0%2C85)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M332.84%2C-25.84L331.07%2C-24.62L327.78%2C-22.52L324.29%2C-20.46L320.63%2C-18.45L316.83%2C-16.48L312.9%2C-14.57L308.87%2C-12.72L306.45%2C-11.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C92%2C1)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M306.45%2C-11.67L304.76%2C-10.94L300.6%2C-9.24L296.42%2C-7.61L292.23%2C-6.06L288.05%2C-4.61L283.92%2C-3.25L279.86%2C-2L278.24%2C-1.53%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(38%2C0%2C85)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M278.24%2C-1.53L275.88%2C-0.85L272.02%2C0.18L268.3%2C1.1L264.73%2C1.89L261.35%2C2.54L256.72%2C3.22L252.19%2C3.6L248.79%2C3.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C92%2C1)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M248.79%2C3.67L247.76%2C3.69L243.44%2C3.53L239.21%2C3.16L235.09%2C2.59L231.07%2C1.86L227.16%2C1L223.34%2C0.04L219.63%2C-0.99L219.29%2C-1.09%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(38%2C0%2C85)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M219.29%2C-1.09L216.02%2C-2.07L212.52%2C-3.16L209.11%2C-4.23L205.81%2C-5.26L201.45%2C-6.77L197.43%2C-8.49L193.69%2C-10.39L191.34%2C-11.74%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C92%2C1)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M191.34%2C-11.74L190.17%2C-12.41L186.82%2C-14.54L183.56%2C-16.73L180.34%2C-18.94L177.11%2C-21.14L173.79%2C-23.29L170.33%2C-25.35%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(38%2C0%2C85)%3Bstroke-width%3A28.8px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M377.95%2C-133.18L377.33%2C-129.12L376.83%2C-125.09L376.42%2C-121.08L376.05%2C-117.09L375.68%2C-113.09L375.27%2C-109.09L374.78%2C-105.06L374.52%2C-103.38%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C230%2C4)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M374.52%2C-103.38L374.16%2C-101L373.37%2C-96.89L372.37%2C-92.73L371.12%2C-88.51L369.57%2C-84.2L368.28%2C-80.88L366.95%2C-77.43L365.9%2C-74.74%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(96%2C0%2C214)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M365.9%2C-74.74L365.57%2C-73.89L364.13%2C-70.27L362.62%2C-66.59L361.01%2C-62.88L359.31%2C-59.16L357.48%2C-55.46L355.52%2C-51.79L353.42%2C-48.17L353.09%2C-47.66%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C230%2C4)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M353.09%2C-47.66L351.16%2C-44.64L348.72%2C-41.2L346.1%2C-37.89L343.28%2C-34.72L340.25%2C-31.72L336.98%2C-28.9L334.15%2C-26.75L332.84%2C-25.84%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(96%2C0%2C214)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M332.84%2C-25.84L331.07%2C-24.62L327.78%2C-22.52L324.29%2C-20.46L320.63%2C-18.45L316.83%2C-16.48L312.9%2C-14.57L308.87%2C-12.72L306.45%2C-11.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C230%2C4)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M306.45%2C-11.67L304.76%2C-10.94L300.6%2C-9.24L296.42%2C-7.61L292.23%2C-6.06L288.05%2C-4.61L283.92%2C-3.25L279.86%2C-2L278.24%2C-1.53%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(96%2C0%2C214)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M278.24%2C-1.53L275.88%2C-0.85L272.02%2C0.18L268.3%2C1.1L264.73%2C1.89L261.35%2C2.54L256.72%2C3.22L252.19%2C3.6L248.79%2C3.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C230%2C4)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M248.79%2C3.67L247.76%2C3.69L243.44%2C3.53L239.21%2C3.16L235.09%2C2.59L231.07%2C1.86L227.16%2C1L223.34%2C0.04L219.63%2C-0.99L219.29%2C-1.09%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(96%2C0%2C214)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M219.29%2C-1.09L216.02%2C-2.07L212.52%2C-3.16L209.11%2C-4.23L205.81%2C-5.26L201.45%2C-6.77L197.43%2C-8.49L193.69%2C-10.39L191.34%2C-11.74%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C230%2C4)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M191.34%2C-11.74L190.17%2C-12.41L186.82%2C-14.54L183.56%2C-16.73L180.34%2C-18.94L177.11%2C-21.14L173.79%2C-23.29L170.33%2C-25.35%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(96%2C0%2C214)%3Bstroke-width%3A21.6px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M353.09%2C-47.66L351.16%2C-44.64L348.72%2C-41.2L346.1%2C-37.89L343.28%2C-34.72L340.25%2C-31.72L336.98%2C-28.9L334.15%2C-26.75L332.84%2C-25.84%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(124%2C0%2C255)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M332.84%2C-25.84L331.07%2C-24.62L327.78%2C-22.52L324.29%2C-20.46L320.63%2C-18.45L316.83%2C-16.48L312.9%2C-14.57L308.87%2C-12.72L306.45%2C-11.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C255%2C5)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M306.45%2C-11.67L304.76%2C-10.94L300.6%2C-9.24L296.42%2C-7.61L292.23%2C-6.06L288.05%2C-4.61L283.92%2C-3.25L279.86%2C-2L278.24%2C-1.53%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(124%2C0%2C255)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M278.24%2C-1.53L275.88%2C-0.85L272.02%2C0.18L268.3%2C1.1L264.73%2C1.89L261.35%2C2.54L256.72%2C3.22L252.19%2C3.6L248.79%2C3.67%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C255%2C5)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M248.79%2C3.67L247.76%2C3.69L243.44%2C3.53L239.21%2C3.16L235.09%2C2.59L231.07%2C1.86L227.16%2C1L223.34%2C0.04L219.63%2C-0.99L219.29%2C-1.09%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(124%2C0%2C255)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M219.29%2C-1.09L216.02%2C-2.07L212.52%2C-3.16L209.11%2C-4.23L205.81%2C-5.26L201.45%2C-6.77L197.43%2C-8.49L193.69%2C-10.39L191.34%2C-11.74%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(0%2C255%2C5)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cpath%20d%3D%22M191.34%2C-11.74L190.17%2C-12.41L186.82%2C-14.54L183.56%2C-16.73L180.34%2C-18.94L177.11%2C-21.14L173.79%2C-23.29L170.33%2C-25.35%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3Argb(124%2C0%2C255)%3Bstroke-width%3A7.2px%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22170.33%22%20cy%3D%22-25.35%22%20r%3D%2213.2%22%20style%3D%22fill%3Argb(0%2C253%2C4)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22170.33%22%20cy%3D%22-25.35%22%20r%3D%2210.2%22%20style%3D%22fill%3Argb(0%2C230%2C4)%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22165%22%20cy%3D%22-24.48%22%20r%3D%224.2%22%20style%3D%22fill%3Awhite%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22168.57%22%20cy%3D%22-30.46%22%20r%3D%224.2%22%20style%3D%22fill%3Awhite%3B%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22163.71%22%20cy%3D%22-25.25%22%20r%3D%222.4%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Cg%20transform%3D%22matrix(3%2C0%2C0%2C3%2C-169.865023%2C745.512005)%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%22167.28%22%20cy%3D%22-31.23%22%20r%3D%222.4%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E%0A", controls: {left: { label: "left", default: "KeyA" },right: { label: "right", default: "KeyD" },boost: { label: "boost", default: "Space" },debug: { label: "debug", default: "KeyV" },restart: { label: "restart", default: "KeyR" },}, factory: function createSnakeIO() {
  const KEYS = Store.bindings.resolve('Snake IO');
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  UI.applyCanvasStyle(canvas, 800 / 600, 'Snake IO');
  const ctx = canvas.getContext('2d');

  let debugMode = false;
  let playerDeathSubmitted = false;

  /* ============ Phase 2: Game State & Spatial Grid ============ */
  const WORLD_R = 2500;
  const FOOD_TARGET = 1200;
  const MAX_BOTS = 35;
  const GRID_CELL = 100;
  const SEG_DIST = 0.5;

  const game = {
    snakes: [], food: [], player: null,
    camera: { x: 0, y: 0, scale: 2.0 }, tick: 0, grid: new Map(),
    deathEvents: []
  };

  function gkey(x, y) { return Math.floor(x / GRID_CELL) + ',' + Math.floor(y / GRID_CELL); }
  function rebuildGrid() {
    game.grid.clear();
    for (const f of game.food) {
      if (f.eaten) continue;
      const k = gkey(f.x, f.y);
      let a = game.grid.get(k); if (!a) { a = []; game.grid.set(k, a); }
      a.push({ t: 'f', o: f });
    }
    for (const s of game.snakes) {
      if (!s.alive || !s.bodyCache) continue;
      const neckSkip = Math.ceil((s.radius * 1.5) / SEG_DIST) + 2;
      for (let i = neckSkip; i < s.bodyCache.length; i += 5) {
        const p = s.bodyCache[i];
        const k = gkey(p.x, p.y);
        let a = game.grid.get(k); if (!a) { a = []; game.grid.set(k, a); }
        a.push({ t: 'b', o: s, p: p });
      }
    }
  }
  function queryGrid(x, y, r, cb) {
    const gx0 = Math.floor((x - r) / GRID_CELL), gx1 = Math.floor((x + r) / GRID_CELL);
    const gy0 = Math.floor((y - r) / GRID_CELL), gy1 = Math.floor((y + r) / GRID_CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const a = game.grid.get(gx + ',' + gy);
        if (a) for (const item of a) cb(item);
      }
    }
  }

  /* ============ Phase 3: Snake Class ============ */
  const COLORS = [
    '#00B8E5', '#D60070', '#00CC44', '#E04500', '#2878D8', '#E6BE00',
    '#7822D2', '#D6147C', '#00B878', '#E66000', '#C41530', '#00A0D8',
    '#82B832', '#C600C6', '#430A82', '#E6E600'
  ];
  const NAMES = ['Viper', 'Slither', 'Coil', 'Hiss', 'Fang', 'Venom', 'Python', 'Mamba', 'Cobra', 'Asp', 'Boa', 'Kaa', 'Naga', 'Slyther', 'Zig', 'Zag', 'Wiggle', 'Snek', 'Noodle', 'Twisty', 'Hisss', 'Coily', 'Serpent', 'Worm', 'Eel', 'Adder', 'Rattler', 'Diamondback'];

  let snakeId = 0;
  function darken(hex, f) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + (r * f | 0) + ',' + (g * f | 0) + ',' + (b * f | 0) + ')';
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function darkenRgb(rgb, f) {
    return `rgb(${Math.min(255, rgb.r * f | 0)},${Math.min(255, rgb.g * f | 0)},${Math.min(255, rgb.b * f | 0)})`;
  }

  class Snake {
    constructor(opts) {
      this.id = ++snakeId;
      this.name = opts.name;
      this.color = opts.color;
      this.rgb1 = hexToRgb(this.color);

      if (Math.random() < 0.5) {
        this.color2 = COLORS[Math.floor(Math.random() * COLORS.length)];
      } else {
        this.color2 = this.color;
      }
      this.rgb2 = hexToRgb(this.color2);

      this.isBot = !!opts.isBot;
      this.deathId = null;

      this.x = opts.x;
      this.y = opts.y;
      this.angle = opts.angle;
      this.tAngle = this.angle;

      this.baseSpeed = 2.4;
      this.boostSpeed = 4.8;
      this.speed = this.baseSpeed;

      this.length = opts.length || 50;
      this.score = Math.floor(this.length);

      this.nodes = [];
      this.distSinceLastNode = 0;
      this.bodyCache = [];
      this.tailPos = { x: this.x, y: this.y };

      this.boost = false;
      this.boostGlow = 0;
      this.boostDropT = 0;
      this.alive = true;
      this.deathT = 0;
      this.turnRate = 0.11;

      this.ai = {
        tick: 0, mode: 'PASSIVE', stateDetail: '', target: null, targetX: null, targetY: null,
        ignoreTarget: null, deathId: null, targetAngleHistory: [], encirclePhase: 'APPROACH',
        aggression: Math.random(), reactionMemory: [], prevDistToTarget: null,
        cursorX: this.x + Math.cos(this.angle) * 200, cursorY: this.y + Math.sin(this.angle) * 200,
        cachedAngle: this.angle, cachedBoost: false, cachedDanger: false, debugPaths: [], sweepTarget: null
      };

      for (let d = SEG_DIST; d <= this.length; d += SEG_DIST) {
        this.nodes.push({
          x: this.x - Math.cos(this.angle) * d,
          y: this.y - Math.sin(this.angle) * d,
          angle: this.angle
        });
      }
      this.updateRadius();
      this.bodyCache = this.getBodyPoints();
    }

    updateRadius() {
      this.radius = 8 + Math.min(16, this.length / 300);
    }

    update(dt) {
      if (!this.alive) {
        if (this.deathT > 0) {
          this.deathT -= 0.04 * dt;
          if (this.deathT <= 0) {
            this.deathT = 0;
            if (this.deathBodyCache) {
              this.dropDeathFood(this.deathBodyCache);
              this.deathBodyCache = null;
            }
          }
        }
        return;
      }

      let diff = this.tAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = this.turnRate * dt;
      if (Math.abs(diff) <= maxTurn) this.angle = this.tAngle;
      else this.angle += Math.sign(diff) * maxTurn;

      if (this.boost && this.length > 30) {
        this.boostGlow += (1 - this.boostGlow) * 0.2 * dt;
        this.speed += (this.boostSpeed - this.speed) * 0.15 * dt;
        this.length -= 0.3 * dt;
        this.score = Math.floor(this.length);

        this.boostDropT += dt;
        if (this.boostDropT > 2) {
          this.boostDropT = 0;
          const tail = this.getTailPos();
          const offX = -Math.cos(this.angle) * (this.radius * 0.5);
          const offY = -Math.sin(this.angle) * (this.radius * 0.5);
          spawnFood(tail.x + offX, tail.y + offY, 1.0, this.color, true, null);
        }
      } else {
        this.boost = false;
        this.boostGlow += (0 - this.boostGlow) * 0.15 * dt;
        if (this.boostGlow < 0.01) this.boostGlow = 0;
        this.speed += (this.baseSpeed - this.speed) * 0.1 * dt;
      }

      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;

      this.distSinceLastNode += this.speed * dt;
      if (this.distSinceLastNode >= SEG_DIST) {
        this.nodes.unshift({ x: this.x, y: this.y });
        this.distSinceLastNode = 0;
        const maxNodes = Math.ceil(this.length / SEG_DIST) + 5;
        if (this.nodes.length > maxNodes) this.nodes.length = maxNodes;
      }

      let pX = this.x;
      let pY = this.y;
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        const cX = node.x;
        const cY = node.y;
        const nX = (i < this.nodes.length - 1) ? this.nodes[i + 1].x : cX;
        const nY = (i < this.nodes.length - 1) ? this.nodes[i + 1].y : cY;

        const midX = (pX + nX) / 2;
        const midY = (pY + nY) / 2;
        const smooth = Math.min(1, 0.2 * dt);
        node.x += (midX - cX) * smooth;
        node.y += (midY - cY) * smooth;

        pX = cX;
        pY = cY;
      }

      let prevX = this.x;
      let prevY = this.y;
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        const dx = node.x - prevX;
        const dy = node.y - prevY;
        const d = Math.hypot(dx, dy);
        if (d > 0) {
          const ratio = SEG_DIST / d;
          node.x = prevX + dx * ratio;
          node.y = prevY + dy * ratio;
        }
        prevX = node.x;
        prevY = node.y;
      }

      this.updateRadius();

      if (this.x * this.x + this.y * this.y > (WORLD_R - this.radius) * (WORLD_R - this.radius)) {
        this.die();
      }

      this.bodyCache = this.getBodyPoints();
      this.tailPos = this.getTailPos();
    }

    getBodyPoints() {
      let points = [{ x: this.x, y: this.y }];
      let dist = 0;
      if (this.nodes.length === 0) return points;

      const d0 = Math.hypot(this.x - this.nodes[0].x, this.y - this.nodes[0].y);
      dist += d0;
      points.push(this.nodes[0]);

      for (let i = 1; i < this.nodes.length; i++) {
        if (dist >= this.length) break;
        const p1 = this.nodes[i - 1];
        const p2 = this.nodes[i];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);

        if (dist + d >= this.length) {
          const t = (this.length - dist) / d;
          points.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
          break;
        }
        dist += d;
        points.push(p2);
      }
      return points;
    }

    getTailPos() {
      let dist = 0;
      if (this.nodes.length === 0) return { x: this.x, y: this.y };

      const d0 = Math.hypot(this.x - this.nodes[0].x, this.y - this.nodes[0].y);
      dist += d0;

      for (let i = 1; i < this.nodes.length; i++) {
        if (dist >= this.length) break;
        const p1 = this.nodes[i - 1];
        const p2 = this.nodes[i];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist + d >= this.length) {
          const t = (this.length - dist) / d;
          return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
        }
        dist += d;
      }
      return this.nodes[this.nodes.length - 1];
    }

    die() {
      if (!this.alive) return;
      this.alive = false;
      this.deathT = 1.0;
      this.boost = false;

      const deathId = Math.random();
      this.deathId = deathId;
      game.deathEvents.push({ id: deathId, x: this.x, y: this.y, t: 180 });

      this.deathBodyCache = this.bodyCache.slice();
    }

    dropDeathFood(pts) {
      if (!pts || pts.length < 2) return;
      const lengthPerOrb = 8;
      const orbSize = 7;
      const numOrbs = Math.max(10, Math.floor(this.length / lengthPerOrb));

      let totalDist = 0;
      for (let i = 1; i < pts.length; i++) {
        totalDist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }

      const spacing = totalDist / numOrbs;
      let distAccumulator = 0;

      for (let i = 1; i < pts.length; i++) {
        const p1 = pts[i - 1], p2 = pts[i];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const segDist = Math.hypot(dx, dy);
        if (segDist === 0) continue;

        const perpX = -dy / segDist;
        const perpY = dx / segDist;

        while (distAccumulator + segDist >= spacing) {
          const remaining = spacing - distAccumulator;
          const t = remaining / segDist;

          const cx = p1.x + dx * t;
          const cy = p1.y + dy * t;

          const wJitter = (Math.random() - 0.5) * this.radius * 1.5;
          const fx = cx + perpX * wJitter;
          const fy = cy + perpY * wJitter;

          spawnFood(fx, fy, orbSize, this.color, true, this.deathId);
          distAccumulator -= spacing;
        }
        distAccumulator += segDist;
      }
    }

    draw(ctx) {
      if (!this.alive) {
        if (this.deathT > 0) {
          ctx.globalAlpha = this.deathT * 0.6;
          const pts = this.bodyCache;
          if (pts && pts.length >= 2) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.radius * 1.8;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        return;
      }

      const pts = this.bodyCache;
      if (!pts || pts.length < 2) return;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const chunkSize = 60;
      let chunksToDraw = [];
      let startIdx = 0;

      for (let i = 1; i < pts.length; i++) {
        if (i - startIdx >= chunkSize || i === pts.length - 1) {
          const colorIdx = Math.floor(startIdx / chunkSize) % 2;
          const c = colorIdx === 0 ? this.rgb1 : this.rgb2;

          chunksToDraw.push({
            p1: pts[startIdx],
            pts: pts.slice(startIdx, i + 1),
            color: c
          });
          startIdx = i;
        }
      }

      const tailPt = pts[pts.length - 1];
      const prevPt = pts[pts.length - 2] || tailPt;
      const tailAngle = Math.atan2(tailPt.y - prevPt.y, tailPt.x - prevPt.x);
      const lastChunk = chunksToDraw[chunksToDraw.length - 1];
      const tailRgb = lastChunk ? lastChunk.color : this.rgb1;

      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';

      for (let i = chunksToDraw.length - 1; i >= 0; i--) {
        const chunk = chunksToDraw[i];

        if (i === chunksToDraw.length - 1) {
          ctx.fillStyle = darkenRgb(tailRgb, 0.4);
          ctx.beginPath();
          ctx.arc(tailPt.x, tailPt.y, this.radius * 1.2, tailAngle - Math.PI / 2, tailAngle + Math.PI / 2);
          ctx.fill();

          ctx.fillStyle = darkenRgb(tailRgb, 1.0);
          ctx.beginPath();
          ctx.arc(tailPt.x, tailPt.y, this.radius * 0.9, tailAngle - Math.PI / 2, tailAngle + Math.PI / 2);
          ctx.fill();

          ctx.fillStyle = darkenRgb(tailRgb, 1.3);
          ctx.beginPath();
          ctx.arc(tailPt.x, tailPt.y, this.radius * 0.3, tailAngle - Math.PI / 2, tailAngle + Math.PI / 2);
          ctx.fill();
        }

        ctx.strokeStyle = darkenRgb(chunk.color, 0.4);
        ctx.lineWidth = this.radius * 2.4;
        ctx.beginPath();
        ctx.moveTo(chunk.p1.x, chunk.p1.y);
        for (let j = 1; j < chunk.pts.length; j++) ctx.lineTo(chunk.pts[j].x, chunk.pts[j].y);
        ctx.stroke();

        ctx.strokeStyle = darkenRgb(chunk.color, 1.0);
        ctx.lineWidth = this.radius * 1.8;
        ctx.stroke();

        ctx.strokeStyle = darkenRgb(chunk.color, 1.3);
        ctx.lineWidth = this.radius * 0.6;
        ctx.stroke();
      }

      ctx.lineCap = 'round';

      if (this.boostGlow > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);

        ctx.lineWidth = this.radius * 2.5;
        ctx.globalAlpha = 0.15 * this.boostGlow;
        ctx.stroke();

        ctx.lineWidth = this.radius * 1.8;
        ctx.globalAlpha = 0.25 * this.boostGlow;
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = this.radius * 1.2;
        ctx.globalAlpha = 0.3 * this.boostGlow;
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.fillStyle = darken(this.color, 1.1);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 0.85, 0, Math.PI * 2); ctx.fill();

      const ea = this.angle;
      const ex1 = this.x + Math.cos(ea - 0.7) * this.radius * 0.45;
      const ey1 = this.y + Math.sin(ea - 0.7) * this.radius * 0.45;
      const ex2 = this.x + Math.cos(ea + 0.7) * this.radius * 0.45;
      const ey2 = this.y + Math.sin(ea + 0.7) * this.radius * 0.45;

      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex1, ey1, this.radius * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2, ey2, this.radius * 0.35, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(ex1 + Math.cos(ea) * 1.5, ey1 + Math.sin(ea) * 1.5, this.radius * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2 + Math.cos(ea) * 1.5, ey2 + Math.sin(ea) * 1.5, this.radius * 0.2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '11px Arial'; ctx.textAlign = 'center';
      ctx.fillText(this.name + ' (' + this.score + ')', this.x, this.y - this.radius - 6);
    }
  }

  /* ============ Phase 3b: Food ============ */
  function spawnFood(x, y, size, color, force, deathId) {
    if (!force && game.food.length > 4000) return;
    if (x * x + y * y > (WORLD_R - 20) * (WORLD_R - 20)) {
      const d = Math.sqrt(x * x + y * y); const f = (WORLD_R - 30) / d; x *= f; y *= f;
    }
    game.food.push({
      x, y, size: size || (2 + Math.random() * 2),
      color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
      glow: Math.random() * Math.PI * 2, eaten: false, deathId: deathId || null
    });
  }

  /* ============ Phase 4: Smart Bot AI ============ */
  function getWeightedRandomSize() {
    const r = Math.random() * 100;
    if (r < 70) return 30 + Math.random() * 120;
    if (r < 90) return 150 + Math.random() * 650;
    if (r < 99) return 800 + Math.random() * 1700;
    return 2500 + Math.random() * 3500;
  }

  function getSafeSpawnLocation() {
    let bestX = 0, bestY = 0, bestDist = -1;
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (WORLD_R - 300);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;

      let minSnakeDist = Infinity;
      for (const s of game.snakes) {
        if (!s.alive) continue;
        const dx = s.x - x, dy = s.y - y;
        const d = dx * dx + dy * dy;
        if (d < minSnakeDist) minSnakeDist = d;
      }

      if (minSnakeDist > bestDist) {
        bestDist = minSnakeDist;
        bestX = x;
        bestY = y;
      }
    }
    return { x: bestX, y: bestY };
  }

  function spawnBot(useWeightedSize) {
    const loc = getSafeSpawnLocation();
    const bot = new Snake({
      x: loc.x,
      y: loc.y,
      angle: Math.random() * Math.PI * 2,
      length: useWeightedSize ? getWeightedRandomSize() : 50,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      name: NAMES[Math.floor(Math.random() * NAMES.length)],
      isBot: true
    });
    game.snakes.push(bot);
  }

  function castRay(bot, angle, maxDist, ignoreSnake) {
    const step = 12;
    for (let d = 8; d <= maxDist; d += step) {
      const rx = bot.x + Math.cos(angle) * d;
      const ry = bot.y + Math.sin(angle) * d;

      if (rx * rx + ry * ry > (WORLD_R - 10) * (WORLD_R - 10)) return d;

      let hit = false;
      queryGrid(rx, ry, 16, (item) => {
        if (hit) return;
        if (item.t === 'b' && item.o !== bot && item.o !== ignoreSnake) {
          const dx = item.p.x - rx, dy = item.p.y - ry;
          if (dx * dx + dy * dy < 256) hit = true;
        }
      });
      if (hit) return d;
    }
    return maxDist;
  }

  function updateBotAI(bot, dt) {
    if (!bot.alive) return;
    bot.ai.tick++;

    if (bot.ai.tick % 10 === 0) {
      bot.ai.target = null;

      if (bot.ai.sweepTarget) {
        let closest = null, clDist = Infinity;
        let furthest = null, fuDist = 0;
        let trailExists = false;

        queryGrid(bot.x, bot.y, 1500, (item) => {
          if (item.t === 'f' && !item.o.eaten && item.o.deathId === bot.ai.sweepTarget.id) {
            trailExists = true;
            const dx = item.o.x - bot.x, dy = item.o.y - bot.y;
            const d = dx * dx + dy * dy;
            if (d < clDist) { clDist = d; closest = item.o; }
            if (d > fuDist) { fuDist = d; furthest = item.o; }
          }
        });

        if (trailExists && furthest) {
          bot.ai.target = furthest;
          let dirX = furthest.x - bot.x, dirY = furthest.y - bot.y;
          const mag = Math.hypot(dirX, dirY);
          if (mag > 0) {
            bot.ai.sweepTarget.dirX = dirX / mag;
            bot.ai.sweepTarget.dirY = dirY / mag;
          }
        } else {
          bot.ai.sweepTarget = null;
        }
      }

      if (!bot.ai.target) {
        let nfDist = Infinity;
        let bestDeathId = null;

        queryGrid(bot.x, bot.y, 600, (item) => {
          if (item.t === 'f' && !item.o.eaten) {
            const dx = item.o.x - bot.x, dy = item.o.y - bot.y;
            const d = dx * dx + dy * dy;
            if (item.o.deathId) {
              if (d < 500 * 500) bestDeathId = item.o.deathId;
            } else {
              if (d < nfDist) { nfDist = d; bot.ai.target = item.o; }
            }
          }
        });

        if (bestDeathId) {
          let furthest = null, fuDist = 0;
          queryGrid(bot.x, bot.y, 1500, (item) => {
            if (item.t === 'f' && !item.o.eaten && item.o.deathId === bestDeathId) {
              const dx = item.o.x - bot.x, dy = item.o.y - bot.y;
              const d = dx * dx + dy * dy;
              if (d > fuDist) { fuDist = d; furthest = item.o; }
            }
          });
          if (furthest) {
            bot.ai.sweepTarget = { id: bestDeathId };
            bot.ai.target = furthest;
            let dirX = furthest.x - bot.x, dirY = furthest.y - bot.y;
            const mag = Math.hypot(dirX, dirY);
            if (mag > 0) {
              bot.ai.sweepTarget.dirX = dirX / mag;
              bot.ai.sweepTarget.dirY = dirY / mag;
            } else {
              bot.ai.sweepTarget.dirX = 1; bot.ai.sweepTarget.dirY = 0;
            }
          }
        }

        if (!bot.ai.target) {
          let prey = null, preyDist = Infinity;
          for (const other of game.snakes) {
            if (other === bot || !other.alive) continue;
            const dx = other.x - bot.x, dy = other.y - bot.y;
            const d = dx * dx + dy * dy;
            const sizeRatio = bot.length / other.length;
            const requiredRatio = 2.0 - (bot.ai.aggression * 0.9);
            const huntRange = 400 + (bot.ai.aggression * 300);

            if (d < huntRange * huntRange && sizeRatio > requiredRatio && d < preyDist) {
              prey = other; preyDist = d;
              bot.ai.target = other;
            }
          }
        }
      }
    }

    if (bot.ai.tick % 5 === 0) {
      const expectedSpeed = bot.boost ? bot.boostSpeed : bot.baseSpeed;
      const turnRates = [-0.15, -0.05, 0, 0.05, 0.15];
      const horizon = 15;
      const stepDist = expectedSpeed * 1.5;

      let bestPathScore = -Infinity;
      let bestTargetAngle = bot.angle;
      let shouldBoost = false;
      let isDangerous = false;

      bot.ai.debugPaths = [];

      for (const tr of turnRates) {
        let simX = bot.x, simY = bot.y, simAngle = bot.angle;
        let pathScore = 0;
        let collided = false;
        const eatenFood = new Set();
        const pathPoints = [{ x: bot.x, y: bot.y }];

        for (let i = 0; i < horizon; i++) {
          simAngle += tr;
          simX += Math.cos(simAngle) * stepDist;
          simY += Math.sin(simAngle) * stepDist;

          const distToCenter = Math.hypot(simX, simY);
          if (distToCenter > WORLD_R - 150) {
            pathScore -= (distToCenter - (WORLD_R - 150)) * 0.5;
          }
          if (distToCenter > WORLD_R - 10) {
            pathScore -= 5000; collided = true; break;
          }

          let dangerHit = false;
          const searchR = bot.radius + 50;
          queryGrid(simX, simY, searchR, (item) => {
            if (dangerHit || collided) return;

            if (item.t === 'b' && item.o !== bot) {
              const dx = item.p.x - simX, dy = item.p.y - simY;
              const rr = bot.radius + item.o.radius + 35;
              if (dx * dx + dy * dy < rr * rr) {
                pathScore -= 2000 - (i * 50);
                dangerHit = true; collided = true;
              }
            }

            if (item.t === 'f' && !item.o.eaten && !eatenFood.has(item.o)) {
              const dx = item.o.x - simX, dy = item.o.y - simY;
              const d2 = dx * dx + dy * dy;
              const rr = bot.radius + item.o.size;

              if (d2 < rr * rr) {
                let foodScore = item.o.size * 25;
                if (item.o.deathId) foodScore *= 4;
                pathScore += foodScore;
                eatenFood.add(item.o);
              } else if (item.o.deathId && d2 < (rr + 45) * (rr + 45)) {
                pathScore += item.o.size * 15;
              }
            }
          });

          if (!collided) {
            for (const other of game.snakes) {
              if (other === bot || !other.alive) continue;
              const dx = other.x - simX, dy = other.y - simY;
              const d2 = dx * dx + dy * dy;
              if (d2 < 80 * 80) {
                const angleToSim = Math.atan2(simY - other.y, simX - other.x);
                let diff = angleToSim - other.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) < 0.4) {
                  pathScore -= 3000;
                  collided = true;
                  break;
                }
              }
            }
          }

          if (collided) break;

          pathScore += 50;
          pathPoints.push({ x: simX, y: simY });
        }

        bot.ai.debugPaths.push({ points: pathPoints, score: pathScore, collided: collided });

        if (!collided && bot.ai.sweepTarget) {
          const pathDirX = simX - bot.x;
          const pathDirY = simY - bot.y;
          const mag = Math.hypot(pathDirX, pathDirY);
          if (mag > 0) {
            const dot = (pathDirX / mag) * bot.ai.sweepTarget.dirX + (pathDirY / mag) * bot.ai.sweepTarget.dirY;
            if (dot > 0) {
              pathScore += dot * 400;
            } else {
              pathScore -= 200;
            }
          }
        }

        if (!collided && bot.ai.target && bot.ai.target.alive && bot.length > bot.ai.target.length * 1.2) {
          const prey = bot.ai.target;
          const speedFactor = expectedSpeed / bot.baseSpeed;
          const preyPredictX = prey.x + Math.cos(prey.angle) * prey.speed * horizon * speedFactor;
          const preyPredictY = prey.y + Math.sin(prey.angle) * prey.speed * horizon * speedFactor;

          const distToPreyPath = Math.hypot(preyPredictX - simX, preyPredictY - simY);

          if (distToPreyPath < 80) {
            pathScore += 2000;
            if (distToPreyPath < 80 && bot.length > 40) shouldBoost = true;
          }
        }

        if (!collided && bot.ai.target) {
          const target = bot.ai.target;
          const distToTargetNow = Math.hypot(target.x - bot.x, target.y - bot.y);
          const distToTargetEnd = Math.hypot(target.x - simX, target.y - simY);
          if (distToTargetEnd < distToTargetNow) pathScore += 20;
        }

        if (pathScore > bestPathScore) {
          bestPathScore = pathScore;
          bestTargetAngle = simAngle;
          if (bestPathScore < 0) isDangerous = true;
        }
      }

      bot.ai.cachedAngle = bestTargetAngle;
      bot.ai.cachedBoost = shouldBoost && bot.length > 30;
      bot.ai.cachedDanger = isDangerous;
    }

    let bestTargetAngle = bot.ai.cachedAngle || bot.angle;
    let shouldBoost = bot.ai.cachedBoost || false;
    let isDangerous = bot.ai.cachedDanger || false;

    if (isDangerous) {
      bot.ai.mode = 'PANIC'; bot.ai.stateDetail = 'DODGE';
    } else if (bot.ai.target && bot.ai.target.alive && bot.length > bot.ai.target.length * 1.2) {
      bot.ai.mode = 'HUNTER'; bot.ai.stateDetail = 'CUTTING';
    } else if (bot.ai.target && bot.ai.target.size) {
      bot.ai.mode = 'PASSIVE'; bot.ai.stateDetail = 'FORAGING';
    } else {
      bot.ai.mode = 'PASSIVE'; bot.ai.stateDetail = 'WANDER';
    }

    let finalAngle = bestTargetAngle;

    let greedBoost = false;
    if (bot.ai.target && bot.ai.target.size && bot.length > 60) {
      const angleToFood = Math.atan2(bot.ai.target.y - bot.y, bot.ai.target.x - bot.x);
      let diff = angleToFood - bot.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.2) greedBoost = true;
    }

    if (isDangerous && bot.length < 200) shouldBoost = false;

    bot.boost = (shouldBoost || greedBoost) && bot.length > 30;

    let cursorDist = bot.boost ? 600 : 300;
    let targetCursorX = bot.x + Math.cos(finalAngle) * cursorDist;
    let targetCursorY = bot.y + Math.sin(finalAngle) * cursorDist;

    bot.ai.cursorX += (targetCursorX - bot.ai.cursorX) * 0.15;
    bot.ai.cursorY += (targetCursorY - bot.ai.cursorY) * 0.15;

    bot.tAngle = Math.atan2(bot.ai.cursorY - bot.y, bot.ai.cursorX - bot.x);
  }

  /* ============ Phase 5: Collisions ============ */
  function checkCollisions() {
    for (const s of game.snakes) {
      if (!s.alive) continue;

      queryGrid(s.x, s.y, s.radius + 10, (item) => {
        if (item.t === 'f' && !item.o.eaten) {
          const dx = item.o.x - s.x, dy = item.o.y - s.y;
          if (dx * dx + dy * dy < (s.radius + item.o.size) * (s.radius + item.o.size)) {
            item.o.eaten = true;
            s.length += item.o.size * 0.5;
            s.score = Math.floor(s.length);
          }
        }
      });

      let dead = false;
      queryGrid(s.x, s.y, s.radius + 10, (item) => {
        if (dead || item.t !== 'b') return;
        const other = item.o;
        if (other === s) return;
        if (!other.alive) return;
        const dx = item.p.x - s.x, dy = item.p.y - s.y;
        const rr = s.radius + other.radius - 2;
        if (dx * dx + dy * dy < rr * rr) dead = true;
      });
      if (dead) s.die();
    }

    const alive = game.snakes.filter(s => s.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const rs = a.radius + b.radius;
        if (dx * dx + dy * dy < rs * rs) {
          if (a.length < b.length) a.die();
          else if (b.length < a.length) b.die();
          else { a.die(); b.die(); }
        }
      }
    }
  }

  /* ============ Phase 3c: Player ============ */
  function createPlayer() {
    const a = Math.random() * Math.PI * 2;
    const s = new Snake({
      x: Math.cos(a) * 200, y: Math.sin(a) * 200,
      angle: a + Math.PI, length: 50,
      color: COLORS[Math.floor(Math.random() * COLORS.length)], name: 'You', isBot: false
    });
    game.player = s;
    game.snakes.push(s);
    game.camera.x = s.x; game.camera.y = s.y;
    return s;
  }

  function respawnPlayer() {
    if (game.player) game.snakes = game.snakes.filter(s => s !== game.player);

    const loc = getSafeSpawnLocation();
    const s = new Snake({
      x: loc.x, y: loc.y,
      angle: Math.random() * Math.PI * 2, length: 50,
      color: COLORS[Math.floor(Math.random() * COLORS.length)], name: 'You', isBot: false
    });
    game.player = s;
    game.snakes.push(s);
    game.camera.x = s.x; game.camera.y = s.y;
  }

  /* ============ Phase 6: Rendering ============ */
  function render() {
    ctx.fillStyle = '#181b22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(game.camera.scale, game.camera.scale);
    ctx.translate(-game.camera.x, -game.camera.y);

    const halfViewW = (canvas.width / 2) / game.camera.scale;
    const halfViewH = (canvas.height / 2) / game.camera.scale;
    const left = game.camera.x - halfViewW;
    const right = game.camera.x + halfViewW;
    const top = game.camera.y - halfViewH;
    const bottom = game.camera.y + halfViewH;

    ctx.save();
    const angle = Math.PI / 4;
    ctx.rotate(angle);

    const b = 100;
    const h = b * 0.8660254;
    const s = 0.60;

    const invAngle = -angle;
    const cosI = Math.cos(invAngle);
    const sinI = Math.sin(invAngle);

    const corners = [
      { x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom }
    ];

    let minGX = Infinity, maxGX = -Infinity, minGY = Infinity, maxGY = -Infinity;
    for (const c of corners) {
      const rx = c.x * cosI - c.y * sinI;
      const ry = c.x * sinI + c.y * cosI;
      if (rx < minGX) minGX = rx;
      if (rx > maxGX) maxGX = rx;
      if (ry < minGY) minGY = ry;
      if (ry > maxGY) maxGY = ry;
    }

    minGX -= b; maxGX += b;
    minGY -= h; maxGY += h;

    ctx.beginPath();

    for (let gy = Math.floor(minGY / h) * h; gy <= maxGY; gy += h) {
      const isOddRow = (Math.round(gy / h) % 2) !== 0;

      const upOffset = isOddRow ? b / 2 : 0;
      for (let gx = Math.floor((minGX - upOffset) / b) * b + upOffset; gx <= maxGX; gx += b) {
        const cX = gx + b / 2;
        const cY = gy + h / 3;

        const p1x = cX + (gx - cX) * s;
        const p1y = cY + (gy - cY) * s;
        const p2x = cX + (gx + b - cX) * s;
        const p2y = cY + (gy - cY) * s;
        const p3x = cX + (gx + b / 2 - cX) * s;
        const p3y = cY + (gy + h - cY) * s;

        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.lineTo(p3x, p3y);
        ctx.closePath();
      }

      const downOffset = isOddRow ? 0 : b / 2;
      for (let gx = Math.floor((minGX - downOffset) / b) * b + downOffset; gx <= maxGX; gx += b) {
        const cX = gx + b / 2;
        const cY = gy + 2 * h / 3;

        const p1x = cX + (gx - cX) * s;
        const p1y = cY + (gy + h - cY) * s;
        const p2x = cX + (gx + b - cX) * s;
        const p2y = cY + (gy + h - cY) * s;
        const p3x = cX + (gx + b / 2 - cX) * s;
        const p3y = cY + (gy - cY) * s;

        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.lineTo(p3x, p3y);
        ctx.closePath();
      }
    }

    ctx.fillStyle = '#21272f';
    ctx.fill();

    ctx.strokeStyle = '#080d10';
    ctx.lineWidth = 7 / game.camera.scale;
    ctx.lineJoin = 'miter';
    ctx.stroke();

    ctx.restore();

    ctx.strokeStyle = 'rgba(255,80,80,0.4)'; ctx.lineWidth = 8 / game.camera.scale;
    ctx.beginPath(); ctx.arc(0, 0, WORLD_R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2 / game.camera.scale;
    ctx.beginPath(); ctx.arc(0, 0, WORLD_R, 0, Math.PI * 2); ctx.stroke();

    for (const f of game.food) {
      if (f.eaten || f.x < left - 30 || f.x > right + 30 || f.y < top - 30 || f.y > bottom + 30) continue;
      const pulse = 0.7 + 0.3 * Math.sin(game.tick * 0.06 + f.glow);
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size * pulse * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const s of game.snakes) s.draw(ctx);

    if (debugMode) {
      ctx.lineWidth = 2 / game.camera.scale;
      ctx.font = (12 / game.camera.scale) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const s of game.snakes) {
        if (!s.alive || !s.isBot) continue;
        if (s.x < left - 400 || s.x > right + 400 || s.y < top - 400 || s.y > bottom + 400) continue;

        if (s.ai.target) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1 / game.camera.scale;
          ctx.setLineDash([5 / game.camera.scale, 5 / game.camera.scale]);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.ai.target.x, s.ai.target.y);
          ctx.stroke();
          ctx.setLineDash([]);

          if (s.ai.target.alive) {
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
            ctx.lineWidth = 2 / game.camera.scale;
            ctx.beginPath();
            ctx.arc(s.ai.target.x, s.ai.target.y, (s.ai.target.radius || 10) + 5, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(s.ai.target.x, s.ai.target.y, 4 / game.camera.scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (s.ai.debugPaths && s.ai.debugPaths.length > 0) {
          let maxScore = -Infinity;
          for (const p of s.ai.debugPaths) if (p.score > maxScore) maxScore = p.score;

          for (const p of s.ai.debugPaths) {
            const isBest = (p.score === maxScore);

            if (isBest) {
              ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
              ctx.lineWidth = 3 / game.camera.scale;
            } else if (p.collided) {
              ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
              ctx.lineWidth = 1 / game.camera.scale;
            } else {
              ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
              ctx.lineWidth = 1 / game.camera.scale;
            }

            ctx.beginPath();
            ctx.moveTo(p.points[0].x, p.points[0].y);
            for (let i = 1; i < p.points.length; i++) {
              ctx.lineTo(p.points[i].x, p.points[i].y);
            }
            ctx.stroke();

            const lastPt = p.points[p.points.length - 1];
            ctx.font = (10 / game.camera.scale) + 'px Arial';
            ctx.fillStyle = isBest ? '#00ffff' : (p.collided ? 'rgba(255,0,0,0.8)' : 'rgba(200,200,200,0.6)');
            ctx.fillText(Math.round(p.score), lastPt.x, lastPt.y);
          }
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.ai.cursorX, s.ai.cursorY, 3 / game.camera.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1 / game.camera.scale;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.ai.cursorX, s.ai.cursorY);
        ctx.stroke();

        let modeColor = '#ffffff';
        if (s.ai.mode === 'HUNTER') modeColor = '#9b59b6';
        else if (s.ai.mode === 'PASSIVE') modeColor = '#2ecc71';
        else if (s.ai.mode === 'PANIC') modeColor = '#e74c3c';

        const txt = s.ai.mode + (s.ai.stateDetail ? ' ' + s.ai.stateDetail : '');
        const txtW = ctx.measureText(txt).width;
        const pad = 4 / game.camera.scale;
        const txtY = s.y - s.radius - 14;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(s.x - txtW / 2 - pad, txtY - (6 / game.camera.scale), txtW + pad * 2, (12 / game.camera.scale));

        ctx.fillStyle = modeColor;
        ctx.fillText(txt, s.x, txtY);
      }
    }

    ctx.restore();
    drawUI();
  }

  function drawUI() {
    const sorted = game.snakes.filter(s => s.alive).sort((a, b) => b.score - a.score).slice(0, 10);
    const lbW = 220, lbH = 28 + sorted.length * 18;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(canvas.width - lbW - 12, 12, lbW, lbH);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.strokeRect(canvas.width - lbW - 12, 12, lbW, lbH);
    ctx.fillStyle = '#FFE66D'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left';
    ctx.fillText('🏆 Leaderboard', canvas.width - lbW - 2, 30);
    ctx.font = '12px Arial';
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      ctx.fillStyle = s === game.player ? '#4ECDC4' : '#ddd';
      const txt = (i + 1) + '. ' + s.name + ' — ' + s.score;
      ctx.fillText(txt, canvas.width - lbW - 2, 50 + i * 18);
    }

    const mm = 140;
    const mmX = canvas.width - mm - 20;
    const mmY = canvas.height - mm - 20;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(mmX, mmY, mm, mm);

    ctx.save();
    ctx.beginPath();
    ctx.rect(mmX, mmY, mm, mm);
    ctx.clip();

    const sc = mm / (WORLD_R * 2);

    ctx.strokeStyle = 'rgba(255,80,80,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mmX + mm / 2, mmY + mm / 2, WORLD_R * sc, 0, Math.PI * 2); ctx.stroke();

    for (const s of game.snakes) {
      if (!s.alive || !s.bodyCache || s.bodyCache.length < 2) continue;

      ctx.strokeStyle = s === game.player ? '#FFFFFF' : s.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const p0 = s.bodyCache[0];
      ctx.moveTo(mmX + mm / 2 + p0.x * sc, mmY + mm / 2 + p0.y * sc);
      for (let i = 1; i < s.bodyCache.length; i++) {
        const p = s.bodyCache[i];
        ctx.lineTo(mmX + mm / 2 + p.x * sc, mmY + mm / 2 + p.y * sc);
      }
      ctx.stroke();
    }

    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(mmX, mmY, mm, mm);

    if (game.player) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px Arial'; ctx.textAlign = 'left';
      ctx.fillText('Score: ' + game.player.score, 20, 34);
      ctx.font = '16px Arial'; ctx.fillStyle = '#aaa';
      ctx.fillText('Length: ' + Math.floor(game.player.length), 20, 58);
      
      const best = Store.scores.get('Snake IO');
      ctx.fillStyle = '#aaa'; ctx.font = '14px Arial';
      ctx.fillText('HI: ' + best, 20, 80);

      if (game.player.boost) {
        ctx.fillStyle = '#FFE66D';
        ctx.fillText('⚡ BOOSTING', 20, 100);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px Arial';
    const controlsText = Utils.prettyKey(KEYS.left) + '/' + Utils.prettyKey(KEYS.right) + ': steer  |  ' + Utils.prettyKey(KEYS.boost) + ': boost  |  ' + Utils.prettyKey(KEYS.debug) + ': Debug';
    ctx.fillText(controlsText, 20, canvas.height - 16);

    if (game.player && !game.player.alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 52px Arial'; ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);
      ctx.fillStyle = '#fff'; ctx.font = '22px Arial';
      ctx.fillText('Final Score: ' + game.player.score, canvas.width / 2, canvas.height / 2 + 10);
      ctx.fillText('Final Length: ' + Math.floor(game.player.length), canvas.width / 2, canvas.height / 2 + 40);
      ctx.fillStyle = '#4ECDC4'; ctx.font = 'bold 18px Arial';
      const restartText = 'Press ' + Utils.prettyKey(KEYS.restart) + ' to Respawn';
      ctx.fillText(restartText, canvas.width / 2, canvas.height / 2 + 90);
    }
  }

  /* ============ Init ============ */
  for (let i = 0; i < FOOD_TARGET; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (WORLD_R - 30);
    spawnFood(Math.cos(a) * r, Math.sin(a) * r, null, null, false, null);
  }

  createPlayer();
  for (let i = 0; i < MAX_BOTS; i++) spawnBot(true);

  return {
    el: canvas,
    onKey(code) {
      if (code === KEYS.restart && game.player && !game.player.alive) {
        respawnPlayer();
        playerDeathSubmitted = false;
      }
      if (code === KEYS.debug) {
        debugMode = !debugMode;
      }
    },
    tick() {
      const dt = 1; // Fixed 60fps logic loop
      game.tick++;

      for (let i = game.deathEvents.length - 1; i >= 0; i--) {
        game.deathEvents[i].t--;
        if (game.deathEvents[i].t <= 0) game.deathEvents.splice(i, 1);
      }

      if (game.player) {
        if (game.player.alive) {
          if (Hub.keys[KEYS.left]) game.player.tAngle -= game.player.turnRate * dt;
          if (Hub.keys[KEYS.right]) game.player.tAngle += game.player.turnRate * dt;

          let pDiff = game.player.tAngle - game.player.angle;
          while (pDiff > Math.PI) pDiff -= Math.PI * 2;
          while (pDiff < -Math.PI) pDiff += Math.PI * 2;
          if (pDiff > 0.5) pDiff = 0.5;
          if (pDiff < -0.5) pDiff = -0.5;
          game.player.tAngle = game.player.angle + pDiff;

          game.player.boost = Hub.keys[KEYS.boost];
        } else {
          if (!playerDeathSubmitted) {
            Store.scores.submit('Snake IO', Math.floor(game.player.score));
            playerDeathSubmitted = true;
          }
        }
        game.player.update(dt);
      }

      for (const s of game.snakes) {
        if (s.isBot) {
          if (s.alive) updateBotAI(s, dt);
          s.update(dt);
        }
      }

      game.snakes = game.snakes.filter(s => s.alive || s.deathT > 0 || s === game.player);

      if (game.tick % 40 === 0) {
        const bc = game.snakes.filter(s => s.isBot && s.alive).length;
        if (bc < MAX_BOTS) spawnBot(false);
      }

      while (game.food.length < FOOD_TARGET) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (WORLD_R - 30);
        spawnFood(Math.cos(a) * r, Math.sin(a) * r, null, null, false, null);
      }

      rebuildGrid();
      checkCollisions();

      if (game.tick % 5 === 0) {
        game.food = game.food.filter(f => !f.eaten);
      }

      if (game.player && game.player.alive) {
        game.camera.x += (game.player.x - game.camera.x) * 0.12;
        game.camera.y += (game.player.y - game.camera.y) * 0.12;

        const targetScale = Math.max(1.2, 2.0 - game.player.length / 2000);
        game.camera.scale += (targetScale - game.camera.scale) * 0.05;
      }

      render();
    },
    destroy() {
      canvas.remove();
    }
  };
} },];
    const HUB_KEYS = {"hide":"KeyH","show":"KeyA+KeyP+KeyL+KeyE","debug":"F3"};
    Games.forEach(g => Store.bindings.register(g.name, g.controls));
    ['game-selector-menu','hub-settings-panel','hub-game-window','dino-game-canvas','gd-game-canvas','rcr-canvas','g','flp','blockblast-canvas', 'game-hub-panel'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
    if (window.GameHub) { window.GameHub.stop(); }
    Hub.init();
    UI.showMenu();
  })();
