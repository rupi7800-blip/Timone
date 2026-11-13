/* Timone · importazione dati (CSV, Excel)
   Formato atteso: una riga per voce, una colonna per anno.
       Voce ; 2023 ; 2024
       Ricavi delle vendite e delle prestazioni ; 1.000.000 ; 1.100.000
   La prima colonna può contenere il codice della voce (es. "ricavi") o il suo nome.
   Le righe non riconosciute NON vengono scartate né indovinate: restano da assegnare a mano. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Importa = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  function norm(s) {
    return String(s === null || s === undefined ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // sinonimi frequenti negli schemi di bilancio; il riconoscimento è per corrispondenza esatta dopo la normalizzazione
  var SINONIMI = {
    ricavi: ['ricavi', 'ricavi delle vendite', 'ricavi vendite e prestazioni', 'fatturato'],
    var_rim_prodotti: ['variazione rimanenze prodotti', 'variazioni delle rimanenze di prodotti in corso di lavorazione semilavorati e finiti'],
    altri_ricavi: ['altri ricavi', 'altri ricavi e proventi'],
    materie: ['materie prime', 'acquisti', 'acquisti di materie', 'costi per materie prime sussidiarie di consumo e di merci', 'per materie prime sussidiarie di consumo e di merci'],
    var_rim_materie: ['variazione rimanenze materie', 'variazioni delle rimanenze di materie prime sussidiarie di consumo e merci'],
    servizi: ['servizi', 'costi per servizi', 'per servizi'],
    godimento: ['godimento beni di terzi', 'costi per godimento di beni di terzi', 'per godimento di beni di terzi'],
    personale: ['personale', 'costi del personale', 'costi per il personale', 'totale costi per il personale'],
    ammortamenti: ['ammortamenti', 'ammortamenti e svalutazioni'],
    svalutazioni_acc: ['svalutazioni e accantonamenti', 'accantonamenti', 'accantonamenti per rischi'],
    oneri_diversi: ['oneri diversi di gestione', 'oneri diversi'],
    proventi_fin: ['proventi finanziari', 'altri proventi finanziari'],
    oneri_fin: ['oneri finanziari', 'interessi passivi', 'interessi e altri oneri finanziari'],
    rettifiche_fin: ['rettifiche di valore di attivita finanziarie', 'rettifiche di valore di attivita e passivita finanziarie'],
    imposte: ['imposte', 'imposte sul reddito', 'imposte sul reddito dell esercizio correnti differite e anticipate'],
    imm_immateriali: ['immobilizzazioni immateriali'], imm_materiali: ['immobilizzazioni materiali'], imm_finanziarie: ['immobilizzazioni finanziarie'],
    rimanenze: ['rimanenze', 'magazzino', 'totale rimanenze'],
    crediti_clienti: ['crediti verso clienti', 'crediti clienti', 'clienti'],
    altri_crediti: ['altri crediti'],
    attivita_fin_breve: ['attivita finanziarie non immobilizzate', 'attivita finanziarie che non costituiscono immobilizzazioni'],
    liquidita: ['disponibilita liquide', 'liquidita', 'cassa e banche', 'totale disponibilita liquide'],
    ratei_attivi: ['ratei e risconti attivi'],
    capitale_riserve: ['capitale e riserve', 'patrimonio netto escluso utile'],
    fondi_rischi: ['fondi per rischi e oneri', 'fondi rischi', 'totale fondi per rischi ed oneri'],
    tfr: ['tfr', 'trattamento di fine rapporto', 'trattamento di fine rapporto di lavoro subordinato'],
    debiti_banche_breve: ['debiti verso banche entro 12 mesi', 'debiti verso banche a breve', 'banche a breve'],
    debiti_banche_lungo: ['debiti verso banche oltre 12 mesi', 'debiti verso banche a lungo', 'mutui'],
    altri_debiti_fin: ['altri debiti finanziari', 'debiti verso soci per finanziamenti'],
    debiti_fornitori: ['debiti verso fornitori', 'fornitori'],
    debiti_tributari: ['debiti tributari e previdenziali', 'debiti tributari'],
    altri_debiti: ['altri debiti'],
    ratei_passivi: ['ratei e risconti passivi'],
    dipendenti: ['dipendenti', 'numero dipendenti', 'numero medio dipendenti'],
    quota_capitale: ['quote capitale rimborsate', 'rimborso finanziamenti']
  };
  var INDICE = {};
  M.VOCI.forEach(function (v) {
    INDICE[norm(v.id)] = v.id; INDICE[norm(v.nome)] = v.id;
    (SINONIMI[v.id] || []).forEach(function (s) { INDICE[norm(s)] = v.id; });
  });
  function riconosci(etichetta) { return INDICE[norm(etichetta)] || null; }

  // "1.234.567,89" · "(1.500)" · "€ 2.000" · "-300" · 1234.5
  function numero(x) {
    if (typeof x === 'number') return isFinite(x) ? x : null;
    var s = String(x === null || x === undefined ? '' : x).trim();
    if (!s) return null;
    var neg = /^\(.*\)$/.test(s) || /^[-−]/.test(s) || /[-−]$/.test(s);
    s = s.replace(/[€\s()−-]/g, '');
    if (!/^[0-9.,]+$/.test(s)) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');        // formato italiano
    else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, ''); // punti come migliaia
    var v = parseFloat(s);
    return isFinite(v) ? (neg ? -v : v) : null;
  }

  // CSV → matrice; separatore ; , o tab riconosciuto dalla prima riga; gestisce le virgolette
  function csv(testo) {
    testo = String(testo).replace(/^﻿/, '');
    var prima = testo.split(/\r?\n/)[0] || '';
    var sep = [';', '\t', ','].sort(function (a, b) { return prima.split(b).length - prima.split(a).length; })[0];
    var righe = [], riga = [], cella = '', inQ = false;
    for (var i = 0; i < testo.length; i++) {
      var c = testo[i];
      if (inQ) {
        if (c === '"' && testo[i + 1] === '"') { cella += '"'; i++; }
        else if (c === '"') inQ = false; else cella += c;
      } else if (c === '"') inQ = true;
      else if (c === sep) { riga.push(cella); cella = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && testo[i + 1] === '\n') i++;
        riga.push(cella); cella = ''; righe.push(riga); riga = [];
      } else cella += c;
    }
    if (cella !== '' || riga.length) { riga.push(cella); righe.push(riga); }
    return righe.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }

  // matrice → {anni, righe:[{etichetta, voce|null, valori:{anno:numero}}], avvisi}
  function interpreta(matrice) {
    var avvisi = [];
    var iTesta = -1, colonne = [];
    for (var i = 0; i < Math.min(matrice.length, 15) && iTesta < 0; i++) {
      var cols = [];
      matrice[i].forEach(function (c, j) { var m = String(c).match(/(19|20)\d{2}/); if (j > 0 && m) cols.push({ j: j, anno: Number(m[0]) }); });
      if (cols.length) { iTesta = i; colonne = cols; }
    }
    if (iTesta < 0) return { anni: [], righe: [], avvisi: ['Non trovo una riga di intestazione con gli anni (es. "Voce; 2023; 2024").'] };
    var visti = {}, righe = [];
    for (var k = iTesta + 1; k < matrice.length; k++) {
      var et = String(matrice[k][0] === undefined ? '' : matrice[k][0]).trim();
      if (!et) continue;
      var valori = {}, qualche = false;
      colonne.forEach(function (c) {
        var v = numero(matrice[k][c.j]);
        if (v !== null) { valori[c.anno] = v; qualche = true; }
      });
      if (!qualche) continue; // titoli di sezione
      var voce = riconosci(et);
      if (voce && visti[voce]) { avvisi.push('La voce "' + M.VOCE[voce].nome + '" compare più volte: la riga "' + et + '" va verificata.'); voce = null; }
      if (voce) visti[voce] = true;
      righe.push({ etichetta: et, voce: voce, valori: valori });
    }
    return { anni: colonne.map(function (c) { return c.anno; }), righe: righe, avvisi: avvisi };
  }

  // applica le righe assegnate all'azienda; restituisce il numero di valori scritti
  function applica(azienda, risultato, nomeFile) {
    var adesso = new Date().toISOString(), scritti = 0;
    risultato.righe.forEach(function (r) {
      if (!r.voce) return;
      Object.keys(r.valori).forEach(function (anno) {
        if (!azienda.esercizi[anno]) azienda.esercizi[anno] = { valori: {} };
        var vecchio = azienda.esercizi[anno].valori[r.voce];
        azienda.storico = azienda.storico || [];
        azienda.storico.push({ quando: adesso, anno: Number(anno), voce: r.voce, da: vecchio ? vecchio.v : null, a: r.valori[anno], origine: 'importato', fonte: nomeFile });
        azienda.esercizi[anno].valori[r.voce] = { v: r.valori[anno], origine: 'importato', fonte: nomeFile, acquisito: adesso, stato: 'da verificare' };
        scritti++;
      });
    });
    if (azienda.storico.length > 1000) azienda.storico = azienda.storico.slice(-1000);
    return scritti;
  }

  function modelloCsv() {
    var a = new Date().getFullYear() - 1;
    var out = ['Voce;Descrizione;' + (a - 1) + ';' + a];
    M.VOCI.forEach(function (v) { out.push(v.id + ';' + v.nome.replace(/;/g, ',') + ';;'); });
    return out.join('\r\n');
  }
  // il modello ha la descrizione in seconda colonna: interpreta() la ignora perché non contiene un anno

  function esportaCsv(azienda) {
    var anni = Object.keys(azienda.esercizi).map(Number).sort();
    var out = ['Voce;Descrizione;' + anni.join(';')];
    M.VOCI.forEach(function (v) {
      out.push(v.id + ';' + v.nome.replace(/;/g, ',') + ';' + anni.map(function (a) {
        var x = azienda.esercizi[a].valori[v.id];
        return x && typeof x.v === 'number' ? String(x.v).replace('.', ',') : '';
      }).join(';'));
    });
    return out.join('\r\n');
  }

  return { numero: numero, csv: csv, interpreta: interpreta, applica: applica, riconosci: riconosci, modelloCsv: modelloCsv, esportaCsv: esportaCsv };
});
