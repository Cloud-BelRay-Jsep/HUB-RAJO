/* ==========================================================================
   HUB · Lógica de la interfaz (sirve para plantas, flotas o áreas)
   --------------------------------------------------------------------------
   No necesitas editar este archivo para agregar o cambiar dashboards:
   todo se configura en config.js.

   La unidad de filtro (planta, flota, área…) se define en config.js → unit.
   Enlaces directos (para compartir por correo), con unit.param = 'flota':
     index.html#flota=caex-930e
     index.html#flota=caex-930e&modulo=scl-930e
   ========================================================================== */
(function () {
  'use strict';

  var C = window.HUB_CONFIG;
  if (!C) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:24px">No se encontró config.js. Verifica que el archivo esté junto a index.html.</p>'); return; }

  var ALL = 'todas';

  /* Unidad de filtro: config.js → unit. Por omisión, plantas (HUB Plantas). */
  var U = C.unit || {};
  U.singular = U.singular || 'planta';
  U.plural = U.plural || 'plantas';
  var UP = U.param || 'planta';                 // parámetro de los enlaces directos
  var STORE_KEY = U.storageKey || 'hub-plant';  // última unidad elegida (por navegador)
  function uAll() { return 'Todas las ' + U.plural; }
  /* Subunidad (subflota). Sin grupos en config.js, es la misma unidad. */
  var SU = C.subunit || U;
  SU.singular = SU.singular || U.singular;
  SU.plural = SU.plural || U.plural;

  /* Los módulos siguen siempre el orden de los pilares (categories) */
  (function () {
    var rank = {};
    C.categories.forEach(function (c, i) { rank[c.id] = i; });
    C.modules = C.modules.map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) {
        var ra = rank[a.m.category] === undefined ? 99 : rank[a.m.category];
        var rb = rank[b.m.category] === undefined ? 99 : rank[b.m.category];
        return ra - rb || a.i - b.i;
      })
      .map(function (x) { return x.m; });
  })();
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = { plant: ALL, view: 'home', module: null, sub: {} };
  var frames = {};          // iframes ya creados, por "modulo:vista"
  var loadTimer = null;

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
      if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function plantById(id) { return C.plants.filter(function (p) { return p.id === id; })[0]; }

  /* Dos niveles opcionales: config.js → groups (flotas) y plants[].group (subflotas).
     Una flota con una sola subflota es "hoja": elegirla equivale a elegir esa subflota. */
  var GROUPS = (C.groups || []).filter(function (g) { return C.plants.some(function (p) { return p.group === g.id; }); });
  if (GROUPS.length) {   // las subflotas siguen el orden de sus flotas
    var gRank = {}; GROUPS.forEach(function (g, i) { gRank[g.id] = i; });
    C.plants = C.plants.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return ((gRank[a.p.group] === undefined ? 99 : gRank[a.p.group]) - (gRank[b.p.group] === undefined ? 99 : gRank[b.p.group])) || a.i - b.i; })
      .map(function (x) { return x.p; });
  }
  function groupById(id) { return GROUPS.filter(function (g) { return g.id === id; })[0]; }
  function plantsOfGroup(gid) { return C.plants.filter(function (p) { return p.group === gid; }); }
  function isLeafGroup(g) { return plantsOfGroup(g.id).length === 1; }
  function isSelfGroup(g) { var ps = plantsOfGroup(g.id); return ps.length === 1 && ps[0].name === g.name; }
  function isGroup(id) { return !plantById(id) && !!groupById(id); }
  function groupOf(id) { var p = plantById(id); return p && p.group ? groupById(p.group) : (isGroup(id) ? groupById(id) : null); }
  function unitById(id) { return plantById(id) || groupById(id); }
  function unitPlants(id) { return id === ALL ? C.plants : isGroup(id) ? plantsOfGroup(id) : [plantById(id)].filter(Boolean); }
  function topIdOf(id) { if (id === ALL || !GROUPS.length) return id; var g = groupOf(id); return g ? g.id : id; }
  function moduleById(id) { return C.modules.filter(function (m) { return m.id === id; })[0]; }
  function catById(id) { return C.categories.filter(function (c) { return c.id === id; })[0] || { name: '' }; }
  function viewsOf(m) { return (m.views && m.views.length) ? m.views : [{ id: 'general', name: m.name, url: m.url || '' }]; }
  function currentView(m) {
    var vs = viewsOf(m), id = state.sub[m.id];
    return vs.filter(function (v) { return v.id === id; })[0] || vs[0];
  }
  /* URL de una vista para la unidad seleccionada:
     urlPorPlanta[unidad] si existe; en una flota (grupo), la de su única subflota con enlace;
     si no, url (vista general / "Todas las …"). key identifica el iframe que se reutiliza. */
  function resolveView(v, id) {
    id = id || state.plant;
    var map = v.urlPorPlanta || {};
    if (id !== ALL && map[id]) return { url: map[id], key: id };
    if (id !== ALL && isGroup(id)) {
      var hits = plantsOfGroup(id).filter(function (p) { return map[p.id]; });
      if (hits.length === 1) return { url: map[hits[0].id], key: hits[0].id };
      if (hits.length > 1 && !v.url) return { url: '', key: 'general', choose: hits };
    }
    return { url: v.url || '', key: 'general' };
  }
  function urlFor(v, plantId) { return resolveView(v, plantId).url; }
  function frameKey(m, v) { return m.id + ':' + v.id + ':' + resolveView(v).key; }

  /* Estado de un módulo en una planta: 'on' | 'partial' | 'soon' | 'off' */
  function statusOf(m, plantId) {
    if (plantId === ALL) return 'on';
    if (isGroup(plantId)) {   // flota: el mejor estado entre sus subflotas
      var ss = plantsOfGroup(plantId).map(function (p) { return statusOf(m, p.id); });
      if (ss.indexOf('on') >= 0) return 'on';
      if (ss.indexOf('partial') >= 0) return 'partial';
      if (ss.length && ss.every(function (x) { return x === 'off'; })) return 'off';
      return 'soon';
    }
    var cov = m.coverage || {};
    var s = cov[plantId] || cov['*'];   // '*' = misma cobertura para todas las subflotas no listadas
    if (s === 'activo') return 'on';
    if (s === 'parcial') return 'partial';
    if (s === 'noAplica') return 'off';
    return 'soon';            // sin avance todavía → "Próximamente"
  }
  function isOpen(s) { return s === 'on' || s === 'partial'; }
  function plantsOn(m) { return C.plants.filter(function (p) { return isOpen(statusOf(m, p.id)); }); }
  function countOn(plantId) { return C.modules.filter(function (m) { return isOpen(statusOf(m, plantId)); }).length; }
  function countPartial(plantId) { return C.modules.filter(function (m) { return statusOf(m, plantId) === 'partial'; }).length; }

  /* Textos de cada estado (cada módulo puede cambiarlos con "etiquetas" en config.js) */
  var LABEL_KEYS = { on: 'activo', partial: 'parcial', soon: 'proximamente', off: 'noAplica' };
  var LABEL_DEFAULTS = { on: 'Activo', partial: 'Avance parcial', soon: 'Próximamente', off: 'No aplica' };
  function labelOf(m, s) { var e = m.etiquetas || {}; return e[LABEL_KEYS[s]] || LABEL_DEFAULTS[s]; }
  /* ¿El módulo solo se ve por planta (sin vista general)? */
  function needsPlant(m) { var v = currentView(m); return !plantById(state.plant) && !urlFor(v) && !!v.urlPorPlanta; }

  /* Acepta una URL o el código <iframe …> completo copiado desde Looker Studio */
  function cleanUrl(raw) {
    if (!raw) return '';
    var s = String(raw).trim();
    var m = s.match(/src\s*=\s*["']([^"']+)["']/i);
    if (m) s = m[1];
    return s.replace(/&amp;/g, '&');
  }

  /* Looker Studio: convierte cualquier enlace del informe al formato embebible */
  function isLooker(url) { return /(^|\.)(lookerstudio|datastudio)\.google\.com$/i.test(hostOf(url)); }
  function hostOf(url) { try { return new URL(url).hostname; } catch (e) { return ''; } }
  function lookerPath(url) {
    var u = new URL(url);
    var p = u.pathname.replace(/^\/u\/\d+/, '').replace(/\/edit\/?$/, '').replace(/^\/embed/, '');
    return { path: p, search: u.search };
  }
  /* Google Drive: carpetas compartidas se muestran como lista de archivos */
  function driveFolderId(url) {
    var m = cleanUrl(url).match(/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|embeddedfolderview\?id=)([\w-]+)/);
    return m ? m[1] : null;
  }
  function isDrive(url) { return !!driveFolderId(url); }
  function embedUrl(url) {
    url = cleanUrl(url);
    var dId = driveFolderId(url);
    if (dId) return 'https://drive.google.com/embeddedfolderview?id=' + dId + '#list';
    if (!url || !isLooker(url)) return url;
    try { var l = lookerPath(url); return 'https://' + hostOf(url) + '/embed' + l.path + l.search; } catch (e) { return url; }
  }
  function externalUrl(url) {
    url = cleanUrl(url);
    var dId = driveFolderId(url);
    if (dId) return 'https://drive.google.com/drive/folders/' + dId;
    if (!url || !isLooker(url)) return url;
    try { var l = lookerPath(url); return 'https://' + hostOf(url) + l.path + l.search; } catch (e) { return url; }
  }
  function sourceLabel(url) { url = cleanUrl(url); return !url ? '' : isDrive(url) ? 'Google Drive' : isLooker(url) ? 'Looker Studio' : 'Página web'; }
  function goText(m) {
    if (needsPlant(m)) return 'Elegir ' + SU.singular;
    return isDrive(urlFor(currentView(m))) ? 'Abrir carpeta' : 'Abrir dashboard';
  }

  /* ---------- marca ---------- */
  function renderBrand() {
    var b = C.brand || {};
    $('hub-title').textContent = b.title || 'HUB';
    $('hub-subtitle').textContent = b.subtitle || '';
    $('status-text').textContent = b.statusText || 'Sistema operativo';
    $('site-text').textContent = b.siteText || '';
    document.querySelectorAll('.logo-slot').forEach(function (slot) {
      var who = b[slot.getAttribute('data-logo')] || {};
      if (who.logo) {
        slot.appendChild(el('img', { class: 'logo-light', src: who.logo, alt: who.name || '' }));
        if (who.logoDark) {
          slot.classList.add('has-dark');
          slot.appendChild(el('img', { class: 'logo-dark', src: who.logoDark, alt: who.name || '' }));
        }
      } else {
        slot.appendChild(el('span', { class: 'logo-slot__ph', title: 'Reemplazar en config.js › brand' }, 'Logo ' + esc(who.name || '')));
      }
    });
  }

  /* ---------- reloj (hora de faena) ---------- */
  function startClock() {
    var tz = (C.brand && C.brand.timeZone) || 'America/Santiago';
    var fmt;
    try { fmt = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }); }
    catch (e) { fmt = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    var c = $('clock');
    c.setAttribute('aria-label', 'Hora local en faena');
    function tick() { var d = new Date(); c.textContent = fmt.format(d); c.setAttribute('datetime', d.toISOString()); }
    tick(); setInterval(tick, 15000);
  }

  /* ---------- selector de planta ---------- */
  var plantBtns = [], indicator;
  function renderPlantbar() {
    var track = $('plantbar');
    indicator = el('span', { class: 'plant-ind', 'aria-hidden': 'true' });
    track.appendChild(indicator);
    var list = [{ id: ALL, name: uAll() }].concat(GROUPS.length ? GROUPS : C.plants);
    list.forEach(function (p) {
      var n = p.id === ALL ? C.modules.length : countOn(p.id);
      var b = el('button', {
        class: 'plant-btn', type: 'button', role: 'radio', 'data-plant': p.id,
        'aria-checked': 'false', tabindex: '-1',
        title: p.id === ALL ? 'Ver todas las soluciones' : n + ' de ' + C.modules.length + ' soluciones con servicio en ' + p.name +
          (GROUPS.length && !isLeafGroup(p) ? ' (' + plantsOfGroup(p.id).length + ' ' + SU.plural + ')' : '')
      }, '<span>' + esc(p.name) + '</span><span class="plant-btn__count" aria-hidden="true">' + n + '/' + C.modules.length + '</span>');
      b.addEventListener('click', function () { setPlant(p.id); });
      track.appendChild(b);
      plantBtns.push(b);
    });
    track.addEventListener('keydown', function (e) {
      if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var i = plantBtns.findIndex(function (b) { return b.getAttribute('aria-checked') === 'true'; });
      if (e.key === 'ArrowRight') i = (i + 1) % plantBtns.length;
      if (e.key === 'ArrowLeft') i = (i - 1 + plantBtns.length) % plantBtns.length;
      if (e.key === 'Home') i = 0;
      if (e.key === 'End') i = plantBtns.length - 1;
      setPlant(plantBtns[i].getAttribute('data-plant'));
      plantBtns[i].focus();
    });
    window.addEventListener('resize', moveIndicator);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);
  }

  /* Fila de subflotas de la flota elegida (solo si la flota tiene más de una) */
  function renderSubbar() {
    var bar = $('subbar'); if (!bar) return;
    var g = GROUPS.length && state.plant !== ALL ? groupOf(state.plant) : null;
    if (!g || isLeafGroup(g)) { bar.hidden = true; bar.innerHTML = ''; bar.removeAttribute('data-group'); return; }
    if (bar.getAttribute('data-group') !== g.id) {
      bar.setAttribute('data-group', g.id);
      bar.setAttribute('aria-label', esc(SU.plural.charAt(0).toUpperCase() + SU.plural.slice(1)) + ' de ' + g.name);
      var list = [{ id: g.id, name: 'Toda la ' + U.singular }].concat(plantsOfGroup(g.id));
      bar.innerHTML = '<span class="subbar__label" aria-hidden="true">' + esc(g.name) + '</span>';
      list.forEach(function (p) {
        var n = countOn(p.id);
        var b = el('button', { class: 'sub-chip' + (p.id === g.id ? ' sub-chip--all' : ''), type: 'button', role: 'radio', 'data-plant': p.id,
          title: n + ' de ' + C.modules.length + ' soluciones con servicio en ' + (p.id === g.id ? g.name : p.name) },
          '<span>' + esc(p.name) + '</span><span class="sub-chip__count" aria-hidden="true">' + n + '/' + C.modules.length + '</span>');
        b.addEventListener('click', function () { setPlant(p.id); });
        bar.appendChild(b);
      });
      bar.onkeydown = function (e) {
        var chips = [].slice.call(bar.querySelectorAll('.sub-chip'));
        rovingKeys(e, chips, function (b) { setPlant(b.getAttribute('data-plant')); });
      };
    }
    bar.hidden = false;
    bar.querySelectorAll('.sub-chip').forEach(function (b) {
      var on = b.getAttribute('data-plant') === state.plant;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.setAttribute('tabindex', on ? '0' : '-1');
    });
  }
  function moveIndicator() {
    var b = plantBtns.filter(function (x) { return x.getAttribute('aria-checked') === 'true'; })[0];
    if (!b || !indicator) return;
    indicator.style.width = b.offsetWidth + 'px';
    indicator.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  }

  /* ---------- tarjetas de módulos ---------- */
  function renderModules() {
    var root = $('modules');
    C.categories.forEach(function (cat) {
      var mods = C.modules.filter(function (m) { return m.category === cat.id; });
      if (!mods.length) return;
      var sec = el('section', { class: 'cat', 'aria-labelledby': 'cat-' + cat.id });
      sec.appendChild(el('div', { class: 'cat__head' },
        '<h2 id="cat-' + cat.id + '">' + esc(cat.name) + '</h2><span class="cat__count" data-cat-count="' + cat.id + '"></span>'));
      var grid = el('div', { class: 'tiles' });
      mods.forEach(function (m) { grid.appendChild(renderTile(m)); });
      sec.appendChild(grid);
      root.appendChild(sec);
    });
  }
  function renderTile(m) {
    var vs = viewsOf(m);
    var t = el('article', { class: 'tile', 'data-module': m.id });
    function pip(p) {
      var s = statusOf(m, p.id);
      return '<span class="pip ' + s + '" data-pip="' + p.id + '" title="' + esc(p.name) + ': ' + esc(labelOf(m, s).toLowerCase()) + '"></span>';
    }
    var pips = GROUPS.length
      ? GROUPS.map(function (g) { return '<span class="pipgrp">' + plantsOfGroup(g.id).map(pip).join('') + '</span>'; }).join('')
      : C.plants.map(pip).join('');
    var nOn = plantsOn(m).length;
    var views = '';
    if (vs.length > 1) {
      views = '<ul class="tile__views" aria-label="Tableros de ' + esc(m.name) + '">' + vs.map(function (v) {
        return '<li><button class="view-chip" type="button" data-view="' + esc(v.id) + '">' + esc(v.name) + '</button></li>';
      }).join('') + '</ul>';
    }
    t.innerHTML =
      '<span class="tile__tape" aria-hidden="true"></span>' +
      '<div class="tile__body">' +
        '<div class="tile__head"><h3><button class="tile__open" type="button">' + esc(m.name) + '</button></h3><span class="badge" aria-live="polite"></span></div>' +
        '<p>' + esc(m.description || '') + '</p>' +
        views +
      '</div>' +
      '<div class="tile__foot">' +
        '<span class="cov"><span class="pips' + (C.plants.length > 10 ? ' pips--dense' : '') + '" aria-hidden="true">' + pips + '</span><span>' + nOn + ' de ' + C.plants.length + ' ' + SU.plural + '</span></span>' +
        '<span class="tile__go"></span>' +
      '</div>';
    t.querySelector('.tile__open').addEventListener('click', function () { openModule(m.id); });
    t.querySelectorAll('.view-chip').forEach(function (b) {
      b.addEventListener('click', function () { openModule(m.id, b.getAttribute('data-view')); });
    });
    return t;
  }
  function updateTiles() {
    var plant = unitById(state.plant);
    var selPips = state.plant === ALL ? [] : unitPlants(state.plant).map(function (p) { return p.id; });
    document.querySelectorAll('.tile').forEach(function (t) {
      var m = moduleById(t.getAttribute('data-module'));
      var s = statusOf(m, state.plant);
      var badge = t.querySelector('.badge'), go = t.querySelector('.tile__go');
      if (state.plant === ALL) {
        t.removeAttribute('data-state');
        badge.className = 'badge'; badge.textContent = '';
        go.textContent = goText(m);
      } else if (s === 'on') {
        t.setAttribute('data-state', 'on');
        badge.className = 'badge badge--on'; badge.textContent = labelOf(m, s) + ' en ' + plant.name;
        go.textContent = goText(m);
      } else if (s === 'partial') {
        t.setAttribute('data-state', 'partial');
        badge.className = 'badge badge--partial'; badge.textContent = labelOf(m, s) + ' en ' + plant.name;
        go.textContent = goText(m);
      } else if (s === 'soon') {
        t.setAttribute('data-state', 'soon');
        badge.className = 'badge badge--soon'; badge.textContent = labelOf(m, s) + ' en ' + plant.name;
        go.textContent = 'Ver ' + SU.plural + ' activas';
      } else {
        t.setAttribute('data-state', 'off');
        badge.className = 'badge badge--off'; badge.textContent = labelOf(m, s) + ' en ' + plant.name;
        go.textContent = 'Ver dónde aplica';
      }
      t.querySelectorAll('.pip').forEach(function (p) {
        p.classList.toggle('sel', selPips.indexOf(p.getAttribute('data-pip')) >= 0);
      });
    });
    document.querySelectorAll('[data-cat-count]').forEach(function (n) {
      var id = n.getAttribute('data-cat-count');
      var mods = C.modules.filter(function (m) { return m.category === id; });
      if (state.plant === ALL) { n.textContent = mods.length + (mods.length === 1 ? ' módulo' : ' módulos'); return; }
      var on = mods.filter(function (m) { return isOpen(statusOf(m, state.plant)); }).length;
      n.textContent = on + ' de ' + mods.length + ' con servicio';
    });
  }

  /* ---------- matriz de cobertura ---------- */
  function renderMatrix() {
    var tb = $('matrix');
    function colHead(p, extra) {
      return '<th scope="col" data-col="' + p.id + '"' + (extra || '') + '><button class="mx-col" type="button" data-plant="' + p.id + '" aria-pressed="false" title="' + esc(p.name) + '">' + esc(p.short || p.name) + '</button></th>';
    }
    var corner = '<th class="rowhead-col" scope="col"' + (GROUPS.length ? ' rowspan="2"' : '') + '><span class="sr" style="position:absolute;left:-9999px">Módulo</span></th>';
    var head;
    if (GROUPS.length) {
      var top = GROUPS.map(function (g) {
        var ps = plantsOfGroup(g.id);
        if (isSelfGroup(g)) return colHead(ps[0], ' rowspan="2" class="g-start mx-leaf" data-grp="' + g.id + '"');
        return '<th scope="colgroup" colspan="' + ps.length + '" class="g-start mx-gh' + (ps.length === 1 ? ' mx-gh--one' : '') + '" data-grp="' + g.id + '"><button class="mx-grp" type="button" data-plant="' + g.id + '" aria-pressed="false" title="' + esc(g.name) + ': ' + ps.length + ' ' + SU.plural + '">' + esc(g.short || g.name) + '</button></th>';
      }).join('');
      var sub = GROUPS.map(function (g) {
        var ps = plantsOfGroup(g.id);
        if (isSelfGroup(g)) return '';
        return ps.map(function (p, i) { return colHead(p, i === 0 ? ' class="g-start"' : ''); }).join('');
      }).join('');
      head = '<thead><tr class="mx-row-g">' + corner + top + '</tr><tr class="mx-row-s">' + sub + '</tr></thead>';
    } else {
      head = '<thead><tr>' + corner + C.plants.map(function (p) { return colHead(p); }).join('') + '</tr></thead>';
    }
    var gStart = {};
    GROUPS.forEach(function (g) { var ps = plantsOfGroup(g.id); if (ps.length) gStart[ps[0].id] = true; });
    /* Filas agrupadas por línea de negocio: un encabezado sobre los módulos de cada pilar */
    function catRow(cat, mods) {
      return '<tr class="mx-cat"><th scope="rowgroup" id="mxcat-' + cat.id + '">' + esc(cat.name) +
        '<small>' + mods.length + (mods.length === 1 ? ' módulo' : ' módulos') + '</small></th>' +
        C.plants.map(function (p) { return '<td data-col="' + p.id + '"' + (gStart[p.id] ? ' class="g-start"' : '') + ' aria-hidden="true"></td>'; }).join('') + '</tr>';
    }
    var body = '<tbody>' + C.categories.map(function (cat) {
      var mods = C.modules.filter(function (m) { return m.category === cat.id; });
      return mods.length ? catRow(cat, mods) + mods.map(moduleRow).join('') : '';
    }).join('') + '</tbody>';
    function moduleRow(m) {
      var n = viewsOf(m).length;
      return '<tr class="mx-mod" data-cat="' + esc(m.category) + '"><th scope="row" headers="mxcat-' + esc(m.category) + '">' + esc(m.name) + (n > 1 ? '<small>' + n + ' tableros</small>' : '') + '</th>' +
        C.plants.map(function (p) {
          var s = statusOf(m, p.id);
          var label = m.name + ' en ' + p.name + ': ' + labelOf(m, s).toLowerCase() + (isOpen(s) ? ' — abrir' : '');
          return '<td data-col="' + p.id + '"' + (gStart[p.id] ? ' class="g-start"' : '') + '><button class="mx-cell" type="button" data-s="' + s + '" data-module="' + m.id + '" data-plant="' + p.id + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"><span class="mark mark--' + s + '"></span></button></td>';
        }).join('') + '</tr>';
    }
    tb.innerHTML = head + body;
    tb.classList.toggle('matrix__table--grouped', !!GROUPS.length);
    tb.style.setProperty('--cols', C.plants.length);
    tb.querySelectorAll('.mx-col, .mx-grp').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-plant');
        setPlant(state.plant === id ? ALL : id);
      });
    });
    tb.querySelectorAll('.mx-cell').forEach(function (b) {
      b.addEventListener('click', function () {
        var pid = b.getAttribute('data-plant'), mid = b.getAttribute('data-module');
        if (isOpen(b.getAttribute('data-s'))) { setPlant(pid, true); openModule(mid); }
        else setPlant(pid);
      });
    });
  }
  function updateMatrix() {
    var sel = state.plant === ALL ? [] : unitPlants(state.plant).map(function (p) { return p.id; });
    var selGrp = state.plant === ALL ? null : topIdOf(state.plant);
    document.querySelectorAll('#matrix [data-col]').forEach(function (c) {
      c.classList.toggle('is-selcol', sel.indexOf(c.getAttribute('data-col')) >= 0);
    });
    document.querySelectorAll('#matrix [data-grp]').forEach(function (c) {
      c.classList.toggle('is-selgrp', c.getAttribute('data-grp') === selGrp);
    });
    document.querySelectorAll('#matrix .mx-col, #matrix .mx-grp').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-plant') === state.plant ? 'true' : 'false');
    });
  }

  /* ---------- encabezado de planta ---------- */
  function updateIntro(animate) {
    var unit = state.plant === ALL ? null : unitById(state.plant);
    var name = unit ? unit.name : uAll();
    var grp = unit && plantById(state.plant) ? groupOf(state.plant) : null;
    var eb = $('plant-group');
    if (eb) { eb.textContent = grp && grp.name !== unit.name ? grp.name : ''; eb.hidden = !eb.textContent; }
    var h = $('plant-heading');
    $('plant-name').textContent = name;
    if (animate && !reduceMotion) { h.classList.remove('is-swapping'); void h.offsetWidth; h.classList.add('is-swapping'); }
    var total = C.modules.length;
    if (state.plant === ALL) {
      $('plant-summary').innerHTML = '<b>' + total + ' soluciones</b> en ' +
        (GROUPS.length ? GROUPS.length + ' ' + U.plural + ' y ' + C.plants.length + ' ' + SU.plural : C.plants.length + ' ' + U.plural) +
        '. Elige una ' + U.singular + ' para ver dónde está activo cada servicio.';
    } else {
      var n = countOn(state.plant), np = countPartial(state.plant), ns = total - n;
      var extra = [];
      if (np) extra.push(np + ' con avance parcial');
      if (ns) extra.push(ns + ' próximamente');
      var subs = isGroup(state.plant) ? plantsOfGroup(state.plant).length : 0;
      $('plant-summary').innerHTML = '<b>' + n + ' de ' + total + ' soluciones</b> con servicio en ' + esc(name) +
        (extra.length ? ' (' + extra.join(', ') + ')' : '') + '.' +
        (subs ? ' Incluye ' + subs + ' ' + SU.plural + ': elige una para filtrar más.' : '');
    }
  }

  /* ---------- cambio de planta ---------- */
  function setPlant(id, silent) {
    if (id !== ALL && !unitById(id)) id = ALL;
    if (isGroup(id) && isLeafGroup(groupById(id))) id = plantsOfGroup(id)[0].id;   // flota de una sola subflota
    var changed = id !== state.plant;
    state.plant = id;
    store(STORE_KEY, id);
    var topId = topIdOf(id);
    plantBtns.forEach(function (b) {
      var on = b.getAttribute('data-plant') === topId;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.setAttribute('tabindex', on ? '0' : '-1');
      if (on && changed && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    moveIndicator();
    renderSubbar();
    updateTiles();
    updateMatrix();
    updateIntro(changed);
    if (state.view === 'viewer') { updateModuleTabs(); showStage(); }
    if (!silent) writeHash(false);
  }

  /* ---------- visor: menú de módulos agrupado por pilar ---------- */
  var catBtns = {}, openMenu = null;
  function renderModuleTabs() {
    var wrap = $('module-switch');
    C.categories.forEach(function (cat) {
      var mods = C.modules.filter(function (m) { return m.category === cat.id; });
      if (!mods.length) return;
      var single = mods.length === 1;
      var g = el('div', { class: 'pill-group' });
      var b = el('button', {
        class: 'cat-btn', type: 'button', 'data-cat': cat.id,
        'aria-haspopup': single ? null : 'menu', 'aria-expanded': single ? null : 'false',
        title: single ? mods[0].name : null
      },
        '<span class="cat-btn__name">' + esc(cat.name) + '</span>' +
        (cat.short ? '<span class="cat-btn__short">' + esc(cat.short) + '</span>' : '') +
        (single ? '' : '<span class="cat-btn__count" aria-label="' + mods.length + ' módulos">' + mods.length + '</span>' +
          '<svg class="ico cat-btn__caret" aria-hidden="true"><use href="#i-caret"/></svg>'));
      g.appendChild(b);
      if (single) {
        b.addEventListener('click', function () { closeMenu(); openModule(mods[0].id); });
      } else {
        var menu = el('div', { class: 'cat-menu', role: 'menu', 'aria-label': cat.name, hidden: true });
        mods.forEach(function (m) {
          var it = el('button', { class: 'cat-menu__item', type: 'button', role: 'menuitemradio', 'aria-checked': 'false', 'data-module': m.id, tabindex: '-1' },
            '<span class="mark" aria-hidden="true"></span><span class="cat-menu__name">' + esc(m.name) + '</span><span class="cat-menu__state"></span>');
          it.addEventListener('click', function () { closeMenu(); openModule(m.id); b.focus(); });
          menu.appendChild(it);
        });
        g.appendChild(menu);
        b.addEventListener('click', function () { openMenu === menu ? closeMenu() : showMenu(b, menu, false); });
        b.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showMenu(b, menu, true); }
        });
        menu.addEventListener('keydown', function (e) {
          var items = [].slice.call(menu.querySelectorAll('.cat-menu__item'));
          var i = items.indexOf(document.activeElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
          else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
          else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
          else if (e.key === 'Tab') { closeMenu(); }
        });
      }
      catBtns[cat.id] = b;
      wrap.appendChild(g);
    });
    document.addEventListener('click', function (e) {
      if (openMenu && !openMenu.parentNode.contains(e.target)) closeMenu();
    });
    // Un clic dentro del tablero (iframe) no llega a la página: cerramos al perder el foco
    window.addEventListener('blur', function () { setTimeout(function () {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') closeMenu();
    }, 0); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openMenu) { var btn = openMenu.parentNode.querySelector('.cat-btn'); closeMenu(); btn.focus(); }
    });
  }
  function showMenu(btn, menu, focusFirst) {
    closeMenu();
    menu.hidden = false;
    menu.classList.remove('is-right');
    btn.setAttribute('aria-expanded', 'true');
    openMenu = menu;
    var r = menu.getBoundingClientRect();
    if (r.right > document.documentElement.clientWidth - 8) menu.classList.add('is-right');
    var items = [].slice.call(menu.querySelectorAll('.cat-menu__item'));
    var cur = menu.querySelector('[aria-checked="true"]');
    if (focusFirst) (cur || items[0]).focus();
  }
  function closeMenu() {
    if (!openMenu) return;
    openMenu.hidden = true;
    var b = openMenu.parentNode.querySelector('.cat-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
    openMenu = null;
  }
  function rovingKeys(e, list, act) {
    if (['ArrowRight', 'ArrowLeft'].indexOf(e.key) < 0) return;
    e.preventDefault();
    var i = list.indexOf(document.activeElement);
    if (i < 0) i = 0;
    i = e.key === 'ArrowRight' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[i].focus(); act(list[i]);
  }
  function updateModuleTabs() {
    var curCat = state.module ? moduleById(state.module).category : null;
    Object.keys(catBtns).forEach(function (cid) {
      var on = cid === curCat;
      catBtns[cid].classList.toggle('is-current', on);
      if (on) catBtns[cid].setAttribute('aria-current', 'true'); else catBtns[cid].removeAttribute('aria-current');
    });
    document.querySelectorAll('.cat-menu__item').forEach(function (it) {
      var m = moduleById(it.getAttribute('data-module'));
      var st = statusOf(m, state.plant);
      it.setAttribute('aria-checked', m.id === state.module ? 'true' : 'false');
      it.setAttribute('data-s', st);
      it.querySelector('.mark').className = 'mark mark--' + st;
      it.querySelector('.cat-menu__state').textContent = (state.plant === ALL || st === 'on') ? '' : labelOf(m, st);
    });
  }
  function renderViewTabs(m) {
    var wrap = $('view-switch');
    var vs = viewsOf(m);
    wrap.innerHTML = '';
    if (vs.length < 2) { wrap.hidden = true; return; }
    wrap.hidden = false;
    var cur = currentView(m), list = [];
    vs.forEach(function (v) {
      var b = el('button', { class: 'view-tab', type: 'button', role: 'tab', 'aria-selected': v.id === cur.id ? 'true' : 'false', tabindex: v.id === cur.id ? '0' : '-1', 'data-view': v.id }, esc(v.name));
      b.addEventListener('click', function () { openModule(m.id, v.id); });
      wrap.appendChild(b); list.push(b);
    });
    wrap.onkeydown = function (e) { rovingKeys(e, list, function (b) { openModule(m.id, b.getAttribute('data-view')); }); };
  }

  function openModule(id, viewId, opts) {
    var m = moduleById(id);
    if (!m) return;
    opts = opts || {};
    var fromHome = state.view !== 'viewer';
    if (viewId && viewsOf(m).some(function (v) { return v.id === viewId; })) state.sub[m.id] = viewId;
    state.module = m.id;
    state.view = 'viewer';
    document.body.setAttribute('data-view', 'viewer');
    $('home').hidden = true;
    $('viewer').hidden = false;

    $('viewer-category').textContent = catById(m.category).name;
    $('viewer-title').textContent = m.name;

    updateModuleTabs();
    renderViewTabs(m);
    if (fromHome) window.scrollTo(0, 0);
    showStage();
    sizeStage();
    if (!opts.fromHistory) writeHash(fromHome);
  }

  function goHome(fromHistory) {
    closeMenu();
    exitFullscreen();
    state.view = 'home'; state.module = null;
    document.body.setAttribute('data-view', 'home');
    $('viewer').hidden = true;
    $('home').hidden = false;
    hideFrames();
    moveIndicator();
    if (!fromHistory) writeHash(false);
  }

  function hideStates() {
    ['state-loading', 'state-nourl', 'state-nocoverage'].forEach(function (s) { $(s).hidden = true; });
    clearTimeout(loadTimer);
  }
  function hideFrames() {
    Object.keys(frames).forEach(function (k) { frames[k].classList.remove('is-active'); });
  }

  function showStage() {
    var m = moduleById(state.module);
    if (!m) return;
    var v = currentView(m);
    var url = urlFor(v);
    var s = statusOf(m, state.plant);
    hideStates(); hideFrames();

    $('viewer-source').textContent = sourceLabel(url);
    $('viewer-source').hidden = !url;
    var ext = $('viewer-external');
    if (url) ext.href = externalUrl(url); else ext.removeAttribute('href');

    var showActions = isOpen(s) && !!url;
    $('viewer-reload').style.visibility = showActions ? '' : 'hidden';
    $('viewer-external').style.visibility = showActions ? '' : 'hidden';

    var vs = $('viewer-status');
    if (s === 'partial') { vs.textContent = labelOf(m, s); vs.hidden = false; } else { vs.hidden = true; }

    if (!isOpen(s)) {
      var pname = unitById(state.plant).name;
      var title = s === 'soon' ? m.name + ' llegará pronto a ' + pname
        : (m.etiquetas && m.etiquetas.noAplica) ? m.name + ': ' + labelOf(m, s).toLowerCase() + ' en ' + pname
        : m.name + ' no aplica en ' + pname;
      var on = plantsOn(m);
      plantChooser(m, title, on.length
        ? 'Este servicio está disponible en ' + (on.length === 1 ? 'esta ' + SU.singular : 'estas ' + SU.plural) + '. Elige una para verlo:'
        : 'Este servicio aún no está disponible en ninguna ' + SU.singular + '.', true);
      return;
    }
    if (!url && needsPlant(m)) {
      var rv = resolveView(v);
      plantChooser(m, 'Elige una ' + SU.singular + ' para ver ' + m.name, 'Este módulo tiene contenido propio para cada ' + SU.singular + '.', false, rv.choose);
      return;
    }
    if (!url) { $('state-nourl').hidden = false; return; }

    var key = frameKey(m, v);
    var f = frames[key];
    if (!f) {
      f = el('iframe', {
        src: embedUrl(url), title: m.name + (viewsOf(m).length > 1 ? ' · ' + v.name : ''),
        allow: 'fullscreen; clipboard-write', allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin', loading: 'eager',
        // Mismos permisos que entrega Looker Studio en su código de inserción
        // (permiten iniciar sesión con Google dentro del iframe)
        sandbox: isLooker(cleanUrl(url)) ? 'allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads' : null
      });
      f.addEventListener('load', function () {
        f.classList.add('is-loaded');
        if (f.classList.contains('is-active')) { hideStates(); }
      });
      frames[key] = f;
      $('frames').appendChild(f);
    }
    f.classList.add('is-active');
    if (!f.classList.contains('is-loaded')) showLoading(url);
  }

  /* Botones de planta (para "no aplica" y para módulos que solo se ven por planta) */
  function plantChooser(m, title, text, offerAll, list) {
    $('nocov-title').textContent = title;
    $('nocov-text').textContent = text;
    var box = $('nocov-plants'); box.innerHTML = '';
    (list || plantsOn(m)).forEach(function (p) {
      var partial = statusOf(m, p.id) === 'partial';
      var b = el('button', { class: 'btn ' + (partial ? 'btn--ghost' : 'btn--solid'), type: 'button' },
        esc(p.name) + (partial ? ' <small>· ' + esc(labelOf(m, 'partial').toLowerCase()) + '</small>' : ''));
      b.addEventListener('click', function () { setPlant(p.id); });
      box.appendChild(b);
    });
    if (offerAll) {
      var all = el('button', { class: 'btn btn--ghost', type: 'button' }, 'Ver en todas las ' + U.plural);
      all.addEventListener('click', function () { setPlant(ALL); });
      box.appendChild(all);
    }
    $('state-nocoverage').hidden = false;
  }

  function showLoading(url) {
    $('state-loading').hidden = false;
    $('loading-hint').hidden = true;
    $('loading-external').href = externalUrl(url);
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () { $('loading-hint').hidden = false; }, 9000);
  }

  function reloadCurrent() {
    var m = moduleById(state.module); if (!m) return;
    var v = currentView(m);
    var f = frames[frameKey(m, v)];
    if (!f) return;
    f.classList.remove('is-loaded');
    showLoading(urlFor(v));
    f.src = f.src;
  }

  function sizeStage() {
    var st = $('stage');
    if (document.body.classList.contains('stage-fs')) { st.style.height = ''; return; }
    var top = st.getBoundingClientRect().top + window.scrollY;
    var h = Math.max(420, window.innerHeight - top - 20);
    st.style.height = h + 'px';
  }

  /* ---------- pantalla completa ---------- */
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement) || document.body.classList.contains('stage-pseudo-fs'); }
  function setFsUi(on) {
    document.body.classList.toggle('stage-fs', on);
    $('viewer-fullscreen').querySelector('span').textContent = on ? 'Salir de pantalla completa' : 'Pantalla completa';
    if (!on) sizeStage();
  }
  function enterFullscreen() {
    var st = $('stage');
    var req = st.requestFullscreen || st.webkitRequestFullscreen;
    if (req) {
      try {
        var p = req.call(st);
        if (p && p.catch) p.catch(pseudoFs);
        return;
      } catch (e) { /* cae a modo alternativo */ }
    }
    pseudoFs();
  }
  function pseudoFs() { document.body.classList.add('stage-pseudo-fs'); setFsUi(true); }
  function exitFullscreen() {
    if (document.body.classList.contains('stage-pseudo-fs')) { document.body.classList.remove('stage-pseudo-fs'); setFsUi(false); return; }
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
  function toggleFullscreen() { isFs() ? exitFullscreen() : enterFullscreen(); }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) {
    document.addEventListener(ev, function () { setFsUi(!!(document.fullscreenElement || document.webkitFullscreenElement)); });
  });

  /* ---------- tema claro / oscuro ---------- */
  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    store('hub-theme', t);
    $('theme-toggle').setAttribute('aria-label', t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#1A1D20' : '#E8EBED');
  }
  function toggleTheme(e) {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || reduceMotion) { applyTheme(next); return; }
    var r = e.currentTarget.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var tr = document.startViewTransition(function () { applyTheme(next); });
    tr.ready.then(function () {
      document.documentElement.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 700, easing: 'cubic-bezier(.16, 1, .3, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () {});
  }

  /* ---------- enlaces directos (#planta=…&modulo=…&vista=…) ---------- */
  function writeHash(push) {
    var p = new URLSearchParams();
    if (state.plant !== ALL) p.set(UP, state.plant);
    if (state.view === 'viewer' && state.module) {
      p.set('modulo', state.module);
      var m = moduleById(state.module);
      if (viewsOf(m).length > 1) p.set('vista', currentView(m).id);
    }
    var h = p.toString();
    var url = location.pathname + location.search + (h ? '#' + h : '');
    try { push ? history.pushState(null, '', url) : history.replaceState(null, '', url); } catch (e) { location.hash = h; }
  }
  function readHash(fromHistory) {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var plant = p.get(UP) || p.get('planta') || (fromHistory ? ALL : (store(STORE_KEY) || ALL));
    setPlant(plant, true);
    var mod = p.get('modulo');
    if (mod && moduleById(mod)) openModule(mod, p.get('vista'), { fromHistory: true });
    else if (state.view === 'viewer') goHome(true);
  }

  /* ---------- fondo: curvas de nivel de un rajo ---------- */
  function drawTerrain() {
    var svg = $('terrain');
    var W = 1600, H = 1000;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function ring(cx, cy, r, amps, phases, n) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2, k = 1;
        for (var j = 0; j < amps.length; j++) k += amps[j] * Math.sin((j + 2) * a + phases[j]);
        pts.push([cx + Math.cos(a) * r * k * 1.25, cy + Math.sin(a) * r * k * .82]);
      }
      // Catmull-Rom → Bézier (curva cerrada suave)
      var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (var q = 0; q < n; q++) {
        var p0 = pts[(q - 1 + n) % n], p1 = pts[q], p2 = pts[(q + 1) % n], p3 = pts[(q + 2) % n];
        d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
             (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' +
             p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return d + 'Z';
    }
    var out = '';
    var phases = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
    for (var k = 0; k < 22; k++) {             // el rajo: bancos concéntricos
      var g = k / 22;
      var amps = [.05 + g * .08, .03 + g * .05, .02 + g * .03, .012];
      out += '<path class="' + (k % 5 === 4 ? 'hi' : '') + '" d="' + ring(1180, 330, 28 + k * 44, amps, phases.map(function (p, i) { return p + g * (i + 1) * .6; }), 72) + '"/>';
    }
    var ph2 = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
    for (var z = 0; z < 10; z++) {              // un cerro al otro lado
      var g2 = z / 10;
      out += '<path class="' + (z % 5 === 4 ? 'hi' : '') + '" d="' + ring(170, 930, 30 + z * 46, [.07 + g2 * .05, .04, .02, .01], ph2.map(function (p, i) { return p + g2 * i * .5; }), 64) + '"/>';
    }
    svg.innerHTML = out;
  }

  /* ---------- inicio ---------- */
  function init() {
    renderBrand();
    startClock();
    drawTerrain();
    renderPlantbar();
    renderModules();
    renderMatrix();
    renderModuleTabs();
    applyTheme(currentTheme());

    $('theme-toggle').addEventListener('click', toggleTheme);
    $('viewer-back').addEventListener('click', function () { goHome(false); });
    $('viewer-fullscreen').addEventListener('click', toggleFullscreen);
    $('stage-exit').addEventListener('click', exitFullscreen);
    $('viewer-reload').addEventListener('click', reloadCurrent);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('stage-pseudo-fs')) exitFullscreen();
    });
    window.addEventListener('resize', function () { if (state.view === 'viewer') sizeStage(); });
    window.addEventListener('popstate', function () { readHash(true); });
    window.addEventListener('hashchange', function () { readHash(true); });

    readHash(false);
    if (state.view !== 'viewer') writeHash(false);
  }

  init();
})();
