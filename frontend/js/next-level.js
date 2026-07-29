/* ============================================================================
   MonitorX — NEXT-LEVEL UI BEHAVIOUR (v2.3 "Orion")
   Progressive enhancement. Loaded AFTER app.js + nasa-enhance.js.
   Adds:
     1) HUD corner brackets on every card
     2) Rotating reticle around the logo
     3) LIVE/REC indicator + telemetry signal bars in footer/header
     4) Header quick-KPI strip (CPU/MEM/DISK/NET mini bars)
     5) Tab-transition smoothing (cross-fade)
     6) Tab notification badges (critical/warn counts)
     7) Metric value-flash on live updates
     8) ⌘/Ctrl-K command palette with keyboard navigation
     9) "?" shortcut overlay
    10) Theme switcher menu (Deep Space / Cyberpunk / Amber / Clean Room)
    11) Tooltip `data-tip` for icon buttons
    12) WebSocket beacon + health-gauge breathing (driven by CSS, JS toggles)
   ============================================================================ */
(function () {
    'use strict';

    /* Helper: robust selector that gracefully returns null */
    var $  = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var parsePct = function (txt) {
        if (!txt) return 0;
        var m = String(txt).match(/(-?\d+(?:\.\d+)?)\s*%/);
        return m ? parseFloat(m[1]) : 0;
    };
    var parseSpeedKB = function (txt) {
        if (!txt) return 0;
        var s = String(txt).toLowerCase();
        var m = s.match(/(-?\d+(?:\.\d+)?)\s*(k|m|g|t)?b\/s/);
        if (!m) return 0;
        var v = parseFloat(m[1]);
        var u = m[2] || 'k';
        var mult = { k: 1, m: 1024, g: 1024 * 1024, t: 1024 * 1024 * 1024 }[u] || 1;
        return v * mult;
    };
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ─────────── 1) ADD HUD CORNER BRACKETS TO CARDS ───────────────── */
    function addHudCorners() {
        var selectors = [
            '.metric-card', '.chart-card', '.troubleshoot-card',
            '.containers-panel', '.pods-panel', '.issues-panel',
            '.top-processes', '.troubleshoot-header-card',
            '.vm-audit-panel'
        ];
        $$(selectors.join(',')).forEach(function (el) {
            if (el.dataset.hudCorners === '1') return;
            el.classList.add('hud-corners');
            var br = document.createElement('span');
            br.className = 'hud-tr';
            el.appendChild(br);
            el.dataset.hudCorners = '1';
        });
    }

    /* ─────────── 2) ROTATING LOGO RETICLE ──────────────────────────── */
    function addLogoReticle() {
        var icon = $('.logo-icon');
        if (icon && !icon.querySelector('.logo-reticle')) {
            var r = document.createElement('span');
            r.className = 'logo-reticle';
            icon.appendChild(r);
        }
    }

    /* ─────────── 3) LIVE/REC INDICATOR IN FOOTER ──────────────────── */
    function addLiveRec() {
        var footer = $('.app-footer');
        if (footer && !footer.querySelector('.live-rec')) {
            var span = document.createElement('span');
            span.className = 'live-rec';
            span.innerHTML = '<i></i> LIVE · TELEMETRY';
            footer.insertBefore(span, footer.firstChild);
        }
    }

    /* ─────────── 4) HEADER QUICK-KPI STRIP ────────────────────────── */
    function buildHdrKpi() {
        if ($('.hdr-kpi-strip')) return;
        var right = $('.header-right');
        if (!right) return;

        var kpis = [
            { id: 'hdr-cpu',  label: 'CPU',  accent: 'blue',  getVal: function () { return parsePct($('#cpu-total')?.textContent); } },
            { id: 'hdr-mem',  label: 'MEM',  accent: 'blue',  getVal: function () { return parsePct($('#ram-percent')?.textContent); } },
            { id: 'hdr-disk', label: 'DSK',  accent: 'blue',  getVal: function () { return parsePct($('#disk-percent')?.textContent); } },
            { id: 'hdr-net',  label: 'NET',  accent: 'blue',  getVal: function () {
                var r = parseSpeedKB($('#net-rx-speed')?.textContent);
                var t = parseSpeedKB($('#net-tx-speed')?.textContent);
                /* scale 0..200 MB/s to 0..100 */
                return Math.min(100, ((r + t) / 1024 / 200) * 100);
            } }
        ];

        var strip = document.createElement('div');
        strip.className = 'hdr-kpi-strip';
        kpis.forEach(function (k) {
            var el = document.createElement('div');
            el.className = 'hdr-kpi';
            el.id = k.id;
            el.innerHTML =
                '<span class="hdr-kpi-label">' + k.label + '</span>' +
                '<span class="hdr-kpi-bar"><i></i></span>' +
                '<span class="hdr-kpi-val">--</span>';
            strip.appendChild(el);
        });

        /* Telemetry signal bars */
        var sig = document.createElement('div');
        sig.className = 'tel-signal';
        sig.id = 'hdr-tel-signal';
        sig.innerHTML = '<i></i><i></i><i></i><i></i>';
        strip.appendChild(sig);

        /* Insert before the uptime/refresh buttons but after the mission readout */
        var mission = $('.mission-readout');
        if (mission && mission.nextSibling) {
            right.insertBefore(strip, mission.nextSibling);
        } else {
            right.insertBefore(strip, right.firstChild);
        }

        setInterval(updateHdrKpi, 1500);
    }
    function updateHdrKpi() {
        var sets = [
            { sel: '#hdr-cpu',  val: parsePct($('#cpu-total')?.textContent),  suffix: '%' },
            { sel: '#hdr-mem',  val: parsePct($('#ram-percent')?.textContent), suffix: '%' },
            { sel: '#hdr-disk', val: parsePct($('#disk-percent')?.textContent), suffix: '%' }
        ];
        var r = parseSpeedKB($('#net-rx-speed')?.textContent);
        var t = parseSpeedKB($('#net-tx-speed')?.textContent);
        var totalKB = r + t;
        var netPct = Math.min(100, (totalKB / 1024 / 200) * 100);
        sets.push({ sel: '#hdr-net', val: netPct, suffix: '' });

        sets.forEach(function (s) {
            var el = $(s.sel);
            if (!el || isNaN(s.val)) return;
            var fill = el.querySelector('.hdr-kpi-bar > i');
            var valEl = el.querySelector('.hdr-kpi-val');
            if (fill) fill.style.width = s.val.toFixed(0) + '%';
            if (valEl) valEl.textContent = s.suffix ? s.val.toFixed(0) + s.suffix : formatSpeed(totalKB);
            el.classList.remove('warn', 'crit');
            if (s.val >= 90) el.classList.add('crit');
            else if (s.val >= 70) el.classList.add('warn');
        });

        /* Signal bars follow websocket state */
        var sig = $('#hdr-tel-signal');
        var wsDot = $('#ws-status .status-dot');
        if (sig && wsDot) {
            if (wsDot.classList.contains('connected')) sig.classList.add('live');
            else sig.classList.remove('live');
        }

        /* Refresh tab badge counts */
        updateTabBadges();
    }
    function formatSpeed(kb) {
        if (kb >= 1024 * 1024) return (kb / 1024 / 1024).toFixed(1) + ' GB/s';
        if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB/s';
        return kb.toFixed(0) + ' KB/s';
    }

    /* ─────────── 5) SMOOTH TAB TRANSITIONS ───────────────────────────
       app.js owns the click → switchTab() logic. We watch for .active changes
       on tab panels via MutationObserver and run a cross-fade between panels
       rather than fighting the click handler with a second listener.          */
    var lastActivePanel = null;
    function hookTabs() {
        lastActivePanel = $('.tab-content.active');
        var main = $('.main-content');
        if (!main) return;
        var mo = new MutationObserver(function () {
            var cur = $('.tab-content.active');
            if (cur && cur !== lastActivePanel) {
                var prev = lastActivePanel;
                lastActivePanel = cur;
                if (prev && !prefersReduced) {
                    /* fade out previous */
                    prev.classList.add('fading-out');
                    setTimeout(function () {
                        prev.style.display = 'none';
                        prev.classList.remove('fading-out');
                        /* entrance animation on cards of newly visible panel */
                        $$('.metric-card, .chart-card, .troubleshoot-card, .check-card, .vm-card, .container-card', cur).forEach(function (c, i) {
                            c.style.opacity = '0';
                            c.style.transform = 'translateY(8px)';
                            setTimeout(function () {
                                c.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                                c.style.opacity = '1';
                                c.style.transform = 'translateY(0)';
                            }, 20 + i * 20);
                        });
                        cur.style.opacity = '0';
                        cur.style.transform = 'translateY(6px)';
                        requestAnimationFrame(function () {
                            cur.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
                            cur.style.opacity = '1';
                            cur.style.transform = 'translateY(0)';
                        });
                    }, 180);
                } else {
                    cur.style.opacity = '0';
                    requestAnimationFrame(function () {
                        cur.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
                        cur.style.opacity = '1';
                        cur.style.transform = 'translateY(0)';
                    });
                }
            }
        });
        $$('.tab-content').forEach(function (tc) {
            mo.observe(tc, { attributes: true, attributeFilter: ['class'] });
        });
    }

    /* ─────────── 6) TAB NOTIFICATION BADGES ────────────────────────── */
    function updateTabBadges() {
        var crit = parseInt(($('#issues-count-critical')?.textContent || '0').replace(/\D/g, ''), 10) || 0;
        var warn = parseInt(($('#issues-count-warning')?.textContent || '0').replace(/\D/g, ''), 10) || 0;
        /* Also include health pill counts if visible */
        var hCrit = parseInt(($('#pill-critical')?.textContent || '0').replace(/\D/g, ''), 10) || 0;
        var hWarn = parseInt(($('#pill-warning')?.textContent || '0').replace(/\D/g, ''), 10) || 0;
        var totalCrit = crit + hCrit;
        var totalWarn = warn + hWarn;

        var tab = $('.tab-btn[data-tab="troubleshoot"]');
        if (!tab) return;
        var existing = tab.querySelector('.tab-badge');
        if (totalCrit === 0 && totalWarn === 0) {
            if (existing) existing.remove();
            return;
        }
        if (!existing) {
            existing = document.createElement('span');
            existing.className = 'tab-badge';
            tab.appendChild(existing);
        }
        if (totalCrit > 0) {
            existing.className = 'tab-badge';
            existing.textContent = totalCrit;
        } else {
            existing.className = 'tab-badge warn';
            existing.textContent = totalWarn;
        }
    }

    /* ─────────── 7) METRIC VALUE-FLASH ON UPDATES ──────────────────── */
    /* We observe key metric elements and flash them when their text changes */
    var watchedValues = new Map();
    function watchValues() {
        var ids = ['cpu-total','ram-percent','disk-percent','net-rx-speed','net-tx-speed','gpu-total','health-score-val','cpu-chart-val','mem-chart-val','net-chart-val','uptime'];
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) watchedValues.set(id, { el: el, last: el.textContent });
        });
    }
    function flashValue(el, kind) {
        if (!el || prefersReduced) return;
        el.classList.remove('flash-up', 'flash-warn', 'flash-crit');
        /* force reflow to restart animation */
        void el.offsetWidth;
        el.classList.add(kind || 'flash-up');
    }
    function pollWatchedValues() {
        watchedValues.forEach(function (obj, id) {
            var cur = obj.el.textContent;
            if (cur !== obj.last) {
                var kind = 'flash-up';
                var pct = parsePct(cur);
                if (id === 'health-score-val') {
                    var h = parseFloat(cur);
                    if (h < 60) kind = 'flash-crit'; else if (h < 80) kind = 'flash-warn';
                } else if (pct >= 90 || id.indexOf('critical') !== -1) {
                    kind = 'flash-crit';
                } else if (pct >= 70) {
                    kind = 'flash-warn';
                }
                flashValue(obj.el, kind);
                obj.last = cur;
            }
        });
        /* Re-scan periodically for late-mounting elements (e.g. GPU) */
        ['gpu-total','health-score-val'].forEach(function (id) {
            if (!watchedValues.has(id)) {
                var el = document.getElementById(id);
                if (el) watchedValues.set(id, { el: el, last: el.textContent });
            }
        });
    }

    /* ─────────── 8) ⌘/CTRL-K COMMAND PALETTE ──────────────────────── */
    var paletteActions = [];
    function registerActions() {
        paletteActions = [
            { group: 'Navigate', label: 'Go to Dashboard',     icon: '📊', kbd: 'G D', run: function () { switchTab('dashboard'); } },
            { group: 'Navigate', label: 'Go to Processes',     icon: '📋', kbd: 'G P', run: function () { switchTab('processes'); } },
            { group: 'Navigate', label: 'Go to Troubleshoot Hub', icon: '🔧', kbd: 'G T', run: function () { switchTab('troubleshoot'); } },
            { group: 'Navigate', label: 'Go to VMs (Libvirt)', icon: '🐳', kbd: 'G V', run: function () { switchTab('vms'); } },
            { group: 'Navigate', label: 'Go to Systemd Services', icon: '⚙️', kbd: 'G S', run: function () { switchTab('services'); } },
            { group: 'Actions',  label: 'Run Diagnostic Scan', icon: '⚡', kbd: 'R',   run: function () { switchTab('troubleshoot'); setTimeout(function(){ $('#run-full-scan-btn')?.click(); }, 150); } },
            { group: 'Actions',  label: 'Refresh Dashboard',   icon: '🔄', kbd: '',    run: function () { $('#refresh-btn')?.click(); } },
            { group: 'Actions',  label: 'Refresh Logs',        icon: '📋', kbd: '',    run: function () { switchTab('troubleshoot'); activateSubtab('log-inspector'); setTimeout(function(){ $('#fetch-logs-btn')?.click(); }, 150); } },
            { group: 'Actions',  label: 'Refresh VMs',         icon: '🐳', kbd: '',    run: function () { switchTab('vms'); setTimeout(function(){ $('#refresh-vms-btn')?.click(); }, 150); } },
            { group: 'Actions',  label: 'Refresh Services',    icon: '⚙️', kbd: '',    run: function () { switchTab('services'); setTimeout(function(){ $('#refresh-services-btn')?.click(); }, 150); } },
            { group: 'Theme',    label: 'Switch Theme… (Deep Space)', icon: '🌌', kbd: '', run: function () { applyTheme('deep'); } },
            { group: 'Theme',    label: 'Switch Theme… (Cyberpunk Neon)', icon: '💜', kbd: '', run: function () { applyTheme('cyberpunk'); } },
            { group: 'Theme',    label: 'Switch Theme… (Amber Terminal)', icon: '🟠', kbd: '', run: function () { applyTheme('amber'); } },
            { group: 'Theme',    label: 'Switch Theme… (Clean Room / Light)', icon: '☀️', kbd: '', run: function () { applyTheme('clean'); } },
            { group: 'Help',     label: 'Keyboard Shortcuts', icon: '⌨️', kbd: '?', run: function () { toggleShortcuts(true); } },
            { group: 'Help',     label: 'Jump to Top',        icon: '↑', kbd: 'G G', run: function () { window.scrollTo({ top: 0, behavior: 'smooth' }); } }
        ];
    }
    function switchTab(name) {
        var btn = $('.tab-btn[data-tab="' + name + '"]');
        if (btn && !btn.classList.contains('active')) btn.click();
    }
    function activateSubtab(name) {
        var btn = $('.sub-tab-btn[data-subtab="' + name + '"]');
        if (btn && !btn.classList.contains('active')) btn.click();
    }

    var paletteEl, paletteInput, paletteList, paletteActiveIdx = 0, paletteFiltered = [];
    function buildPalette() {
        var bd = document.createElement('div');
        bd.className = 'cmdk-backdrop';
        bd.id = 'cmdk-backdrop';
        bd.innerHTML =
            '<div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command Palette">' +
                '<div class="cmdk-input-row">' +
                    '<span class="cmdk-icon">⚡</span>' +
                    '<input type="text" class="cmdk-input" id="cmdk-input" placeholder="Type a command or search… (e.g. &quot;scan&quot;, &quot;vm&quot;, &quot;theme&quot;)" />' +
                    '<span class="cmdk-hint">ESC</span>' +
                '</div>' +
                '<div class="cmdk-list" id="cmdk-list"></div>' +
                '<div class="cmdk-footer">' +
                    '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>' +
                    '<span><kbd>↵</kbd> run</span>' +
                    '<span><kbd>esc</kbd> close</span>' +
                '</div>' +
            '</div>';
        document.body.appendChild(bd);
        paletteEl = bd;
        paletteInput = $('#cmdk-input', bd);
        paletteList = $('#cmdk-list', bd);

        bd.addEventListener('click', function (e) {
            if (e.target === bd) closePalette();
        });
        paletteInput.addEventListener('input', function () { renderPalette(paletteInput.value); });
        paletteInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); paletteActiveIdx = Math.min(paletteFiltered.length - 1, paletteActiveIdx + 1); renderPalette(paletteInput.value, true); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); paletteActiveIdx = Math.max(0, paletteActiveIdx - 1); renderPalette(paletteInput.value, true); }
            else if (e.key === 'Enter') { e.preventDefault(); var item = paletteFiltered[paletteActiveIdx]; if (item) runPaletteAction(item); }
            else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
        });
    }
    function renderPalette(query, keepActive) {
        if (!paletteList) return;
        query = (query || '').trim().toLowerCase();
        var scored = paletteActions.map(function (a) {
            var text = (a.label + ' ' + a.group).toLowerCase();
            var score = query === '' ? 1 : (text.indexOf(query) !== -1 ? 2 : 0);
            return { a: a, score: score };
        }).filter(function (x) { return x.score > 0; });
        scored.sort(function (a, b) { return b.score - a.score; });
        paletteFiltered = scored.map(function (x) { return x.a; });

        if (!keepActive) paletteActiveIdx = 0;
        if (paletteActiveIdx >= paletteFiltered.length) paletteActiveIdx = Math.max(0, paletteFiltered.length - 1);

        if (paletteFiltered.length === 0) {
            paletteList.innerHTML = '<div class="cmdk-empty">No commands match. Try "scan", "logs", "theme", "vm".</div>';
            return;
        }

        /* Group by group */
        var html = '';
        var lastGroup = null;
        paletteFiltered.forEach(function (a, i) {
            if (a.group !== lastGroup) {
                html += '<div class="cmdk-group-title">' + a.group + '</div>';
                lastGroup = a.group;
            }
            var activeCls = i === paletteActiveIdx ? ' active' : '';
            html +=
                '<div class="cmdk-item' + activeCls + '" data-idx="' + i + '">' +
                    '<span class="cmdk-item-icon">' + a.icon + '</span>' +
                    '<span class="cmdk-item-text">' + a.label + '</span>' +
                    (a.kbd ? '<span class="cmdk-item-kbd">' + a.kbd + '</span>' : '') +
                '</div>';
        });
        paletteList.innerHTML = html;

        $$('.cmdk-item', paletteList).forEach(function (el) {
            el.addEventListener('mouseenter', function () {
                paletteActiveIdx = parseInt(el.dataset.idx, 10);
                $$('.cmdk-item', paletteList).forEach(function (x) { x.classList.remove('active'); });
                el.classList.add('active');
            });
            el.addEventListener('click', function () {
                var idx = parseInt(el.dataset.idx, 10);
                runPaletteAction(paletteFiltered[idx]);
            });
        });

        /* scroll into view */
        var active = $('.cmdk-item.active', paletteList);
        if (active) active.scrollIntoView({ block: 'nearest' });
    }
    function runPaletteAction(a) {
        closePalette();
        try { a.run(); } catch (err) { console.warn('[cmdk] action failed', err); }
    }
    function openPalette() {
        if (!paletteEl) buildPalette();
        registerActions();
        paletteEl.classList.add('open');
        setTimeout(function () {
            paletteInput.value = '';
            renderPalette('');
            paletteInput.focus();
        }, 30);
    }
    function closePalette() {
        if (paletteEl) paletteEl.classList.remove('open');
    }

    /* ─────────── 9) KEYBOARD SHORTCUTS OVERLAY ────────────────────── */
    var kbEl;
    function buildShortcuts() {
        var bd = document.createElement('div');
        bd.className = 'kb-backdrop';
        bd.id = 'kb-backdrop';
        bd.innerHTML =
            '<div class="kb-panel">' +
                '<h3>⌨️  Flight Deck Shortcuts</h3>' +
                '<div class="kb-grid">' +
                    row('Open Command Palette', '<kbd>⌘</kbd><kbd>K</kbd> / <kbd>Ctrl</kbd><kbd>K</kbd>') +
                    row('Show/hide shortcuts', '<kbd>?</kbd>') +
                    row('Dashboard', '<kbd>G</kbd> <kbd>D</kbd>') +
                    row('Processes', '<kbd>G</kbd> <kbd>P</kbd>') +
                    row('Troubleshoot Hub', '<kbd>G</kbd> <kbd>T</kbd>') +
                    row('VMs', '<kbd>G</kbd> <kbd>V</kbd>') +
                    row('Services', '<kbd>G</kbd> <kbd>S</kbd>') +
                    row('Run Diagnostic Scan', '<kbd>R</kbd>') +
                    row('Refresh', '<kbd>F5</kbd> / <kbd>⌘</kbd><kbd>R</kbd>') +
                    row('Toggle Theme', '<kbd>T</kbd>') +
                    row('Close overlay / modal', '<kbd>Esc</kbd>') +
                    row('Jump to top', '<kbd>G</kbd> <kbd>G</kbd>') +
                '</div>' +
                '<div class="kb-foot">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</div>' +
            '</div>';
        document.body.appendChild(bd);
        kbEl = bd;
        bd.addEventListener('click', function (e) { if (e.target === bd) toggleShortcuts(false); });
    }
    function row(label, kbd) {
        return '<div class="kb-row"><span>' + label + '</span><span>' + kbd + '</span></div>';
    }
    function toggleShortcuts(show) {
        if (!kbEl) buildShortcuts();
        if (show === undefined) show = !kbEl.classList.contains('open');
        kbEl.classList.toggle('open', show);
    }

    /* ─────────── 10) THEME SWITCHER MENU ─────────────────────────── */
    var themeMenuEl;
    function buildThemeMenu() {
        var btn = $('#theme-toggle');
        if (!btn) return;
        btn.title = '';
        btn.setAttribute('data-tip', 'CYCLE THEME (T) · RIGHT-CLICK FOR MENU');

        /* Replace button to drop app.js's light/dark-only click handler. */
        var freshBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(freshBtn, btn);
        btn = freshBtn;

        var wrap = document.createElement('div');
        wrap.style.position = 'relative';
        wrap.style.display = 'inline-flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '0';
        btn.parentNode.insertBefore(wrap, btn);
        wrap.appendChild(btn);

        var menu = document.createElement('div');
        menu.className = 'theme-menu';
        menu.id = 'theme-menu';
        menu.innerHTML =
            '<div class="theme-menu-label">Visual Theme</div>' +
            themeItem('deep',    '🌌 Deep Space',  'Default HUD', 'deep') +
            themeItem('cyber',   '💜 Cyberpunk',   'Neon magenta/cyan', 'cyber') +
            themeItem('amber',   '🟠 Amber CRT',   'Monochrome terminal', 'amber') +
            themeItem('clean',   '☀️ Clean Room',  'Bright daylight', 'clean');
        wrap.appendChild(menu);
        themeMenuEl = menu;

        /* Left-click on the theme button = cycle themes. */
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var order = ['deep','cyberpunk','amber','clean'];
            var cur = 'deep';
            try { cur = localStorage.getItem('monitorx.theme') || 'deep'; } catch (err) {}
            var idx = order.indexOf(cur);
            applyTheme(order[(idx + 1) % order.length]);
        });
        /* Right-click = open theme menu. */
        btn.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();
            menu.classList.toggle('open');
        });

        document.addEventListener('click', function () { menu.classList.remove('open'); });
        $$('.theme-menu-item', menu).forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                applyTheme(item.dataset.theme);
                menu.classList.remove('open');
            });
        });
    }
    function themeItem(id, label, sub, swatch) {
        return '<div class="theme-menu-item" data-theme="' + id + '">' +
                    '<span class="theme-swatch ' + swatch + '"></span>' +
                    '<span>' + label + '</span>' +
                    '<small>' + sub + '</small>' +
                '</div>';
    }
    function applyTheme(name) {
        document.body.classList.remove('theme-cyberpunk', 'theme-amber', 'theme-clean');
        document.body.classList.remove('light-theme');
        if (name === 'cyberpunk') document.body.classList.add('theme-cyberpunk');
        else if (name === 'amber') document.body.classList.add('theme-amber');
        else if (name === 'clean') document.body.classList.add('light-theme', 'theme-clean');
        /* update active marker */
        if (themeMenuEl) {
            $$('.theme-menu-item', themeMenuEl).forEach(function (el) {
                el.classList.toggle('active', el.dataset.theme === name);
            });
        }
        try { localStorage.setItem('monitorx.theme', name); } catch (e) {}
        /* Toggle moon/sun label */
        var btn = $('#theme-toggle');
        if (btn) btn.textContent = name === 'clean' ? '☀️' : (name === 'amber' ? '🟠' : (name === 'cyberpunk' ? '💜' : '🌙'));
    }
    function restoreTheme() {
        var saved = 'deep';
        try { saved = localStorage.getItem('monitorx.theme') || 'deep'; } catch (e) {}
        applyTheme(saved);
    }

    /* ─────────── 11) TOOLTIPS FOR ICON BUTTONS ────────────────────── */
    function installTooltips() {
        var map = {
            'refresh-btn': 'REFRESH (R)',
            'theme-toggle': 'THEME',
            'ws-status':    'DATALINK'
        };
        Object.keys(map).forEach(function (id) {
            var el = document.getElementById(id);
            if (el && !el.getAttribute('data-tip')) el.setAttribute('data-tip', map[id]);
        });
    }

    /* ─────────── GLOBAL KEYBOARD HANDLER ─────────────────────────── */
    var lastKey = { key: '', time: 0 };
    function onGlobalKey(e) {
        var tgt = e.target;
        var isTyping = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);

        /* Ctrl/Cmd-K → palette (even while typing) */
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openPalette();
            return;
        }

        if (paletteEl && paletteEl.classList.contains('open')) return; /* dialog handles own keys */
        if (kbEl && kbEl.classList.contains('open')) {
            if (e.key === 'Escape') { e.preventDefault(); toggleShortcuts(false); }
            return;
        }

        /* Close modals on Esc */
        if (e.key === 'Escape') {
            var openModal = $('.modal[style*="display: flex"], .modal.open');
            /* Fallback: many modals use inline display flex; app.js opens them via style.display */
            $$('.modal').forEach(function (m) {
                if (m.style.display === 'flex' || m.style.display === 'block') {
                    var closeBtn = m.querySelector('.modal-close');
                    if (closeBtn) closeBtn.click();
                }
            });
            if (themeMenuEl) themeMenuEl.classList.remove('open');
            return;
        }

        if (isTyping) return;

        /* ? → help */
        if (e.key === '?') { e.preventDefault(); toggleShortcuts(true); return; }

        /* T → theme cycle */
        if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
            var order = ['deep','cyberpunk','amber','clean'];
            var cur = 'deep';
            try { cur = localStorage.getItem('monitorx.theme') || 'deep'; } catch (err) {}
            var idx = order.indexOf(cur);
            applyTheme(order[(idx + 1) % order.length]);
            return;
        }

        /* R is reserved by app.js (refresh). Leave it alone. */

        /* G-prefix for "go to" */
        var now = Date.now();
        if (e.key.toLowerCase() === 'g') {
            if (lastKey.key === 'g' && now - lastKey.time < 800) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                lastKey = { key: '', time: 0 };
            } else {
                lastKey = { key: 'g', time: now };
            }
            return;
        }
        if (lastKey.key === 'g' && now - lastKey.time < 800) {
            var map = { d: 'dashboard', p: 'processes', t: 'troubleshoot', v: 'vms', s: 'services' };
            var dest = map[e.key.toLowerCase()];
            if (dest) { switchTab(dest); e.preventDefault(); }
            lastKey = { key: '', time: 0 };
            return;
        }
        lastKey = { key: '', time: 0 };
    }

    /* ─────────── EXPOSE for nasa-enhance / app.js interop ─────────── */
    window.MonitorXNext = {
        openPalette: openPalette,
        closePalette: closePalette,
        toggleShortcuts: toggleShortcuts,
        applyTheme: applyTheme,
        refreshTabBadges: updateTabBadges
    };

    /* ─────────── BOOT ─────────────────────────────────────────────── */
    function boot() {
        addHudCorners();
        addLogoReticle();
        addLiveRec();
        buildHdrKpi();
        hookTabs();
        watchValues();
        buildPalette();
        registerActions();
        buildShortcuts();
        installTooltips();
        restoreTheme();
        buildThemeMenu();
        updateHdrKpi();
        updateTabBadges();

        /* ⌘K chip launches palette */
        var launch = document.getElementById('cmdk-launch');
        if (launch) launch.addEventListener('click', function (e) { e.preventDefault(); openPalette(); });

        document.addEventListener('keydown', onGlobalKey);

        setInterval(addHudCorners, 3500);     /* cards can be added dynamically */
        setInterval(pollWatchedValues, 1200); /* flash on live value changes */
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
