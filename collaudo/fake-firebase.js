// Finto Firebase v8 per il collaudo: stessa semantica del Realtime Database
// (array salvati come chiavi numeriche, null = cancella, eventi sincroni sulle scritture locali).
(function () {
  window.__errori = [];
  window.__consoleErrori = [];
  window.addEventListener('error', e => window.__errori.push((e.message || 'errore') + ' @ riga ' + e.lineno));
  window.addEventListener('unhandledrejection', e => window.__errori.push('promise: ' + ((e.reason && e.reason.message) || e.reason)));
  const ce = console.error.bind(console);
  console.error = (...a) => { window.__consoleErrori.push(a.map(String).join(' ')); ce(...a); };

  const fb = {
    tree: {}, connesso: false, ritardaCaricamento: true, inAttesa: [], listeners: [],
    scritture: [], alerts: [], n: 0,
  };
  window.__fb = fb;
  window.alert = m => { fb.alerts.push(String(m)); };
  window.confirm = () => true;
  window.prompt = () => '';

  const parti = p => String(p || '').split('/').filter(Boolean);
  const unisci = p => parti(p).join('/');
  const isIntKey = k => /^-?(0|[1-9]\d*)$/.test(k) && Math.abs(Number(k)) <= 2147483647;
  function cmpKey(a, b) {
    const ia = isIntKey(a), ib = isIntKey(b);
    if (ia && ib) return Number(a) - Number(b);
    if (ia) return -1;
    if (ib) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function normalizza(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && !isFinite(v)) throw new Error('Firebase: numero non valido');
    if (typeof v !== 'object') return v;
    const out = {};
    const voci = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.entries(v);
    voci.forEach(([k, x]) => {
      if (x === undefined) throw new Error('Firebase: valore undefined nella proprietà ' + k);
      if (/[.#$\[\]\/]/.test(k)) throw new Error('Firebase: chiave non valida ' + k);
      const n = normalizza(x);
      if (n !== null) out[k] = n;
    });
    return Object.keys(out).length ? out : null;
  }
  function aJS(node) {
    if (node === null || node === undefined) return null;
    if (typeof node !== 'object') return node;
    const keys = Object.keys(node).sort(cmpKey);
    if (keys.length && keys.every(k => /^(0|[1-9]\d*)$/.test(k))) {
      const max = Math.max(...keys.map(Number));
      if (max < 2 * keys.length) { const arr = []; keys.forEach(k => { arr[Number(k)] = aJS(node[k]); }); return arr; }
    }
    const o = {}; keys.forEach(k => { o[k] = aJS(node[k]); }); return o;
  }
  function getAt(path) {
    let n = fb.tree;
    for (const p of parti(path)) { if (!n || typeof n !== 'object') return null; n = n[p]; }
    return n === undefined ? null : n;
  }
  function pota(ps) {
    for (let i = ps.length - 1; i >= 1; i--) {
      const padre = i === 1 ? fb.tree : getAt(ps.slice(0, i - 1).join('/'));
      if (!padre || typeof padre !== 'object') continue;
      const nodo = padre[ps[i - 1]];
      if (nodo && typeof nodo === 'object' && !Object.keys(nodo).length) delete padre[ps[i - 1]];
    }
  }
  function setAt(path, valore) {
    const ps = parti(path);
    const v = normalizza(valore);
    if (!ps.length) { fb.tree = (v && typeof v === 'object') ? v : {}; return; }
    let n = fb.tree;
    for (let i = 0; i < ps.length - 1; i++) { if (!n[ps[i]] || typeof n[ps[i]] !== 'object') n[ps[i]] = {}; n = n[ps[i]]; }
    const last = ps[ps.length - 1];
    if (v === null) delete n[last]; else n[last] = v;
    pota(ps);
  }
  function snapshot(path) {
    const p = unisci(path);
    const node = getAt(p);
    return {
      key: parti(p).pop() || null,
      val: () => aJS(node === null ? null : JSON.parse(JSON.stringify(node))),
      exists: () => node !== null,
      numChildren: () => (node && typeof node === 'object') ? Object.keys(node).length : 0,
      child: c => snapshot(p + '/' + c),
      forEach(cb) {
        if (!node || typeof node !== 'object') return false;
        return Object.keys(node).sort(cmpKey).some(k => cb(snapshot(p + '/' + k)) === true);
      },
    };
  }
  const json = p => JSON.stringify(getAt(p));
  function consegna(l) { l.ultimo = json(l.path); l.cb(snapshot(l.path)); }
  function avvisaCambiati() {
    fb.listeners.slice().forEach(l => {
      if (l.path === '.info/connected' || l.inAttesa) return;
      if (json(l.path) !== l.ultimo) consegna(l);
    });
  }
  function scrivi(updates, tipo, opzioni = {}) {
    const chiavi = Object.keys(updates);
    // In Firebase i percorsi di un update multiplo non possono sovrapporsi
    chiavi.forEach(a => chiavi.forEach(b => { if (a !== b && (b + '/').startsWith(a + '/')) throw new Error('Firebase: percorsi sovrapposti ' + a + ' / ' + b); }));
    chiavi.forEach(k => normalizza(updates[k]));
    chiavi.forEach(k => setAt(k, updates[k]));
    fb.scritture.push({ tipo, chiavi, remota: !!opzioni.remota, offline: !fb.connesso && !opzioni.remota });
    if (!opzioni.silenziosa) avvisaCambiati();
  }
  function nuovaChiave() { return '-Ntest' + String(++fb.n).padStart(5, '0'); }
  function ref(path) {
    const p = unisci(path);
    return {
      key: parti(p).pop() || null,
      child: c => ref(p + '/' + c),
      on(ev, cb) {
        const l = { path: p, cb, inAttesa: false, ultimo: undefined };
        fb.listeners.push(l);
        if (p === '.info/connected') { cb({ val: () => fb.connesso }); return cb; }
        if (fb.ritardaCaricamento) { l.inAttesa = true; fb.inAttesa.push(l); return cb; }
        consegna(l);
        return cb;
      },
      off(ev, cb) { fb.listeners = fb.listeners.filter(l => !(l.path === p && (!cb || l.cb === cb))); },
      once() { return Promise.resolve(snapshot(p)); },
      set(v) { scrivi({ [p]: v }, 'set'); return Promise.resolve(); },
      update(obj) {
        const u = {};
        Object.keys(obj).forEach(k => { u[unisci((p ? p + '/' : '') + k)] = obj[k]; });
        scrivi(u, 'update');
        return Promise.resolve();
      },
      remove() { scrivi({ [p]: null }, 'remove'); return Promise.resolve(); },
      push(v) {
        const k = nuovaChiave();
        const conThen = ref(p + '/' + k), semplice = ref(p + '/' + k);
        if (v !== undefined && v !== null) conThen.set(v);
        const pr = Promise.resolve(semplice);
        conThen.then = pr.then.bind(pr);
        conThen.catch = pr.catch.bind(pr);
        return conThen;
      },
    };
  }

  fb.caricaDati = dati => { fb.tree = normalizza(dati) || {}; };
  fb.rilasciaCaricamento = () => { fb.ritardaCaricamento = false; fb.inAttesa.splice(0).forEach(l => { l.inAttesa = false; consegna(l); }); };
  fb.setConnesso = v => { fb.connesso = v; fb.listeners.filter(l => l.path === '.info/connected').forEach(l => l.cb({ val: () => fb.connesso })); };
  fb.scritturaRemota = (updates, silenziosa) => scrivi(updates, 'remota', { remota: true, silenziosa });
  fb.consegnaTutto = () => avvisaCambiati();
  fb.leggi = path => aJS(getAt(path));
  fb.nodo = path => getAt(path);

  const utente = { uid: 'uid-test', email: 'test@example.com', getIdToken: () => Promise.resolve('token') };
  const auth = {
    currentUser: null,
    onAuthStateChanged(cb) { auth._cb = cb; setTimeout(() => { auth.currentUser = utente; cb(utente); }, 0); return () => {}; },
    signInWithEmailAndPassword() { auth.currentUser = utente; if (auth._cb) auth._cb(utente); return Promise.resolve({ user: utente }); },
    signOut() { auth.currentUser = null; if (auth._cb) auth._cb(null); return Promise.resolve(); },
  };
  const database = { ref };
  window.firebase = {
    initializeApp: () => ({}),
    auth: () => auth,
    database: () => database,
    firestore: () => ({}),
    apps: [],
  };
})();
