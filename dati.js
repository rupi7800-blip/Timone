/* Timone · archivio dati
   Un'unica interfaccia, tre possibilità scelte per ogni installazione/azienda:
     - "locale"   : dati nel browser di questo dispositivo (prove, simulazioni, uso singolo)
     - "supabase" : database Supabase in cloud (multi-utente, multi-azienda)
     - "server"   : server dell'azienda con Supabase auto-ospitato o compatibile
                    (stesso schema PostgreSQL: cambia solo l'indirizzo)
   L'app usa sempre le stesse funzioni: elenco(), carica(), salva(), elimina(). */
(function (root) {
  'use strict';
  var CH_CONF = 'timone.archivio', CH_DATI = 'timone.aziende';
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  function leggi(chiave, predef) { try { var x = localStorage.getItem(chiave); return x ? JSON.parse(x) : predef; } catch (e) { return predef; } }
  function scrivi(chiave, v) { try { localStorage.setItem(chiave, JSON.stringify(v)); return true; } catch (e) { return false; } }

  var memoria = null; // usata se il browser non consente il salvataggio locale
  var conf = leggi(CH_CONF, { tipo: 'locale', url: '', chiave: '' });
  var client = null;

  function caricaScript(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { ko(new Error('Impossibile caricare ' + src + ' (connessione assente?)')); };
      document.head.appendChild(s);
    });
  }
  function sb() {
    if (client) return Promise.resolve(client);
    if (!conf.url || !conf.chiave) return Promise.reject(new Error('Indirizzo o chiave del database mancanti: completa le Impostazioni.'));
    var p = root.supabase ? Promise.resolve() : caricaScript(SDK);
    return p.then(function () { client = root.supabase.createClient(conf.url, conf.chiave); return client; });
  }
  function esito(r) { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data; }

  // ------------------------------------------------------------ locale
  var Locale = {
    tutte: function () { return memoria || leggi(CH_DATI, {}); },
    scriviTutte: function (t) { if (!scrivi(CH_DATI, t)) memoria = t; },
    elenco: function () { var t = this.tutte(); return Promise.resolve(Object.keys(t).map(function (id) { return { id: id, nome: t[id].nome, simulata: !!t[id].simulata, ruolo: 'titolare' }; })); },
    carica: function (id) { var a = this.tutte()[id]; return Promise.resolve(a ? JSON.parse(JSON.stringify(a)) : null); },
    salva: function (az) {
      if (!az.id) az.id = 'az-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      var t = this.tutte(); t[az.id] = az; this.scriviTutte(t); return Promise.resolve(az);
    },
    elimina: function (id) { var t = this.tutte(); delete t[id]; this.scriviTutte(t); return Promise.resolve(); }
  };

  // ---------------------------------------------- Supabase / server aziendale
  // i totali da ripartire letti dall'XBRL viaggiano nel profilo (i valori stanno nella tabella "valori")
  function vincoliDi(az) { var v = {}; Object.keys(az.esercizi || {}).forEach(function (a) { if (az.esercizi[a].vincoli) v[a] = az.esercizi[a].vincoli; }); return v; }
  function profiloDi(az) {
    return { settore: az.settore || '', forma: az.forma || '', ateco: az.ateco || '', simulata: !!az.simulata, simulazione: az.simulazione || null,
      classificazione: az.classificazione || {}, budget: az.budget || {}, scenari: az.scenari || {},
      codiceFiscale: az.codiceFiscale || '', moduli: az.moduli || {}, commesse: az.commesse || null, magazzino: az.magazzino || null, personale: az.personale || null, energia: az.energia || null, produzione: az.produzione || null, investimenti: az.investimenti || null, decisioni: az.decisioni || null, finanziamenti: az.finanziamenti || null, commerciale: az.commerciale || null, benchmark: az.benchmark || null, vincoli: vincoliDi(az) };
  }
  var Remoto = {
    elenco: function () {
      return sb().then(function (c) { return c.from('membri').select('ruolo, aziende(id, nome, profilo)'); }).then(esito).then(function (righe) {
        return righe.filter(function (r) { return r.aziende; }).map(function (r) { return { id: r.aziende.id, nome: r.aziende.nome, simulata: !!(r.aziende.profilo && r.aziende.profilo.simulata), ruolo: r.ruolo }; });
      });
    },
    carica: function (id) {
      var c;
      return sb().then(function (x) { c = x; return c.from('aziende').select('*').eq('id', id).single(); }).then(esito).then(function (a) {
        return Promise.all([
          c.from('valori').select('*').eq('azienda_id', id).then(esito),
          c.from('storico_valori').select('*').eq('azienda_id', id).order('quando', { ascending: false }).limit(300).then(esito),
          c.from('membri').select('ruolo').eq('azienda_id', id).then(esito)
        ]).then(function (res) {
          var p = a.profilo || {}, esercizi = {};
          res[0].forEach(function (v) {
            if (!esercizi[v.anno]) esercizi[v.anno] = { valori: {} };
            esercizi[v.anno].valori[v.voce] = { v: Number(v.valore), origine: v.origine, fonte: v.fonte, acquisito: v.acquisito_il, stato: v.stato_verifica };
          });
          return { id: a.id, nome: a.nome, settore: p.settore, forma: p.forma, ateco: p.ateco, simulata: !!p.simulata, simulazione: p.simulazione,
            classificazione: p.classificazione || {}, budget: p.budget || {}, scenari: p.scenari || {}, esercizi: (function () { Object.keys(p.vincoli || {}).forEach(function (a) { if (!esercizi[a]) esercizi[a] = { valori: {} }; esercizi[a].vincoli = p.vincoli[a]; }); return esercizi; })(),
            codiceFiscale: p.codiceFiscale || '', moduli: p.moduli || {}, commesse: p.commesse || undefined, magazzino: p.magazzino || undefined, personale: p.personale || undefined, energia: p.energia || undefined, produzione: p.produzione || undefined, investimenti: p.investimenti || undefined, decisioni: p.decisioni || undefined, finanziamenti: p.finanziamenti || undefined, commerciale: p.commerciale || undefined, benchmark: p.benchmark || undefined,
            ruolo: (res[2][0] || {}).ruolo || 'sola_lettura',
            storico: res[1].reverse().map(function (s) { return { quando: s.quando, anno: s.anno, voce: s.voce, da: s.valore_prima === null ? null : Number(s.valore_prima), a: s.valore_dopo === null ? null : Number(s.valore_dopo), origine: s.origine, fonte: s.fonte }; }) };
        });
      });
    },
    salva: function (az) {
      var c;
      return sb().then(function (x) {
        c = x;
        var remotoId = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(az.id || '');
        if (remotoId) return c.from('aziende').update({ nome: az.nome, profilo: profiloDi(az) }).eq('id', az.id).then(esito);
        return c.rpc('crea_azienda', { p_nome: az.nome, p_profilo: profiloDi(az) }).then(esito).then(function (id) { az.id = id; });
      }).then(function () {
        var righe = [];
        Object.keys(az.esercizi || {}).forEach(function (anno) {
          var val = az.esercizi[anno].valori || {};
          Object.keys(val).forEach(function (voce) {
            var x = val[voce];
            if (x && typeof x.v === 'number' && isFinite(x.v)) righe.push({ azienda_id: az.id, anno: Number(anno), voce: voce, valore: x.v, origine: x.origine || 'manuale', fonte: x.fonte || null, stato_verifica: x.stato || 'da verificare', acquisito_il: x.acquisito || new Date().toISOString() });
          });
        });
        return c.from('valori').select('anno, voce').eq('azienda_id', az.id).then(esito).then(function (esistenti) {
          var tieni = {};
          righe.forEach(function (r) { tieni[r.anno + '|' + r.voce] = true; });
          var via = esistenti.filter(function (e) { return !tieni[e.anno + '|' + e.voce]; });
          var p = Promise.resolve();
          via.forEach(function (e) { p = p.then(function () { return c.from('valori').delete().eq('azienda_id', az.id).eq('anno', e.anno).eq('voce', e.voce).then(esito); }); });
          return p.then(function () { return righe.length ? c.from('valori').upsert(righe, { onConflict: 'azienda_id,anno,voce' }).then(esito) : null; });
        });
      }).then(function () { return az; });
    },
    elimina: function (id) { return sb().then(function (c) { return c.from('aziende').delete().eq('id', id); }).then(esito); }
  };

  function driver() { return conf.tipo === 'locale' ? Locale : Remoto; }

  root.Archivio = {
    configurazione: function () { return Object.assign({}, conf); },
    configura: function (nuova) { conf = { tipo: nuova.tipo || 'locale', url: (nuova.url || '').trim().replace(/\/+$/, ''), chiave: (nuova.chiave || '').trim() }; client = null; scrivi(CH_CONF, conf); },
    remoto: function () { return conf.tipo !== 'locale'; },
    elenco: function () { return driver().elenco(); },
    carica: function (id) { return driver().carica(id); },
    salva: function (az) { return driver().salva(az); },
    elimina: function (id) { return driver().elimina(id); },
    // autenticazione (solo archivi remoti)
    utente: function () { if (conf.tipo === 'locale') return Promise.resolve(null); return sb().then(function (c) { return c.auth.getSession(); }).then(function (r) { return r.data && r.data.session ? r.data.session.user : null; }); },
    accedi: function (email, password) { return sb().then(function (c) { return c.auth.signInWithPassword({ email: email, password: password }); }).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data.user; }); },
    registra: function (email, password) { return sb().then(function (c) { return c.auth.signUp({ email: email, password: password }); }).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; }); },
    esci: function () { return sb().then(function (c) { return c.auth.signOut(); }); },
    invita: function (aziendaId, email, ruolo) { return sb().then(function (c) { return c.rpc('aggiungi_membro', { p_azienda: aziendaId, p_email: email, p_ruolo: ruolo }); }).then(esito); },
    membri: function (aziendaId) { return sb().then(function (c) { return c.rpc('elenco_membri', { p_azienda: aziendaId }); }).then(esito); }
  };
})(typeof self !== 'undefined' ? self : this);
