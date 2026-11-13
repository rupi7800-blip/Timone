/* Timone · simulatore generale
   Crea aziende di fantasia con bilanci pluriennali coerenti (attivo = passivo per costruzione),
   per collaudare il motore senza usare dati reali. Tutti i valori sono marcati "simulato".
   I parametri dei settori sono di FANTASIA: servono al collaudo, non sono benchmark. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Simulatore = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var SETTORI = {
    manifatturiera: { nome: 'Manifatturiera', materie: 0.48, servizi: 0.17, godimento: 0.02, personale: 0.18, amm: 0.045, oneri: 0.01, scorta: 70, dso: 80, dpo: 75, imm: 0.40, quote: { servizi: 0.5, personale: 0.15 } },
    commerciale: { nome: 'Commerciale', materie: 0.70, servizi: 0.09, godimento: 0.025, personale: 0.09, amm: 0.012, oneri: 0.008, scorta: 60, dso: 55, dpo: 65, imm: 0.12, quote: { servizi: 0.4, personale: 0 } },
    servizi: { nome: 'Servizi', materie: 0.05, servizi: 0.25, godimento: 0.04, personale: 0.48, amm: 0.02, oneri: 0.01, scorta: 5, dso: 80, dpo: 50, imm: 0.10, quote: { servizi: 0.5, personale: 0.1 } },
    artigiana: { nome: 'Artigiana', materie: 0.35, servizi: 0.15, godimento: 0.03, personale: 0.30, amm: 0.03, oneri: 0.01, scorta: 40, dso: 60, dpo: 55, imm: 0.25, quote: { servizi: 0.4, personale: 0.1 } },
    professionista: { nome: 'Libero professionista', materie: 0.02, servizi: 0.22, godimento: 0.06, personale: 0.15, amm: 0.02, oneri: 0.02, scorta: 0, dso: 60, dpo: 30, imm: 0.08, quote: { servizi: 0.3, personale: 0 } }
  };

  // atteso: criticità che il motore DEVE trovare; vietato: gravità che NON deve comparire.
  var PROFILI = {
    sana: { nome: 'Azienda in equilibrio', descr: 'Crescita moderata, margini stabili, debito contenuto.', atteso: [], nessunRosso: true },
    margini_in_calo: { nome: 'Margini in calo', descr: 'Costi di materie e personale che crescono più dei ricavi.', atteso: ['marginalita_calo'] },
    tensione_liquidita: { nome: 'Tensione di liquidità', descr: 'Incassi sempre più lenti e debito spostato sul breve.', atteso: ['incassi'] },
    sovraindebitata: { nome: 'Sovraindebitata', descr: 'Debito finanziario molto alto rispetto ai margini.', atteso: ['indebitamento'] },
    magazzino_eccessivo: { nome: 'Magazzino eccessivo', descr: 'Scorte che crescono anno dopo anno.', atteso: ['magazzino'] },
    in_perdita: { nome: 'Ricavi in calo e perdita', descr: 'Volumi in discesa con costi di struttura invariati.', atteso: ['ricavi_calo'] }
  };

  function rng(seme) { // mulberry32
    var a = seme >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var NOMI_A = ['Officine', 'Tecno', 'Nuova', 'Fratelli', 'Gruppo', 'Studio', 'Bottega', 'Laboratorio'];
  var NOMI_B = ['Aurora', 'Borgonovo', 'Castelletto', 'Delta', 'Erre', 'Fontana', 'Granito', 'Lario', 'Meridiana', 'Orizzonte', 'Prisma', 'Ticino'];

  /* opzioni: { settore, profilo, ricavi (ultimo anno indicativo), anni (2-6), annoFinale, seme } */
  function genera(opz) {
    opz = opz || {};
    var seme = (opz.seme === undefined || opz.seme === null || opz.seme === '') ? Math.floor(Math.random() * 1e9) : Number(opz.seme);
    var R = rng(seme);
    var S = SETTORI[opz.settore] || SETTORI.manifatturiera;
    var chiaveSettore = SETTORI[opz.settore] ? opz.settore : 'manifatturiera';
    var chiaveProfilo = PROFILI[opz.profilo] ? opz.profilo : 'sana';
    var anni = Math.max(2, Math.min(6, Math.round(opz.anni || 4)));
    var annoFinale = Math.round(opz.annoFinale || (new Date().getFullYear() - 1));
    var ricaviBase = Math.max(50000, Number(opz.ricavi) || 2000000);
    var rumore = function (amp) { return 1 + (R() * 2 - 1) * amp; };

    var crescita = { sana: 0.04, margini_in_calo: 0.0, tensione_liquidita: 0.06, sovraindebitata: 0.01, magazzino_eccessivo: 0.0, in_perdita: -0.10 }[chiaveProfilo];
    var levaDebito = { sana: 1.2, margini_in_calo: 2.2, tensione_liquidita: 2.5, sovraindebitata: 6.5, magazzino_eccessivo: 2.2, in_perdita: 2.5 }[chiaveProfilo];
    var tasso = chiaveProfilo === 'sovraindebitata' ? 0.07 : 0.05;

    // quote di partenza con un po' di variabilità
    var q = { materie: S.materie * rumore(0.03), servizi: S.servizi * rumore(0.03), godimento: S.godimento, personale: S.personale * rumore(0.03), amm: S.amm, oneri: S.oneri };
    var margineTeorico = 1.01 - S.materie - S.servizi - S.godimento - S.personale - S.oneri;
    // nel profilo sovraindebitato il debito ha finanziato investimenti pesanti
    var immRatio = S.imm + (chiaveProfilo === 'sovraindebitata' ? 6 * margineTeorico : 0);
    var payout = (chiaveProfilo === 'sovraindebitata' || chiaveProfilo === 'tensione_liquidita') ? 1 : 0.3;
    var ricavi0 = ricaviBase / Math.pow(1 + crescita, anni - 1);
    var esercizi = {}, prec = null, precR = null;
    var personaleFisso = null, godimentoFisso = null, immPrec = null;

    for (var i = 0; i < anni; i++) {
      var anno = annoFinale - (anni - 1) + i;
      var ricavi = ricavi0 * Math.pow(1 + crescita, i) * rumore(0.015);
      var n = {};
      var sMat = q.materie, sPers = q.personale, sServ = q.servizi;
      if (chiaveProfilo === 'margini_in_calo') { sMat += 0.022 * i; sPers += 0.012 * i; }
      var scorta = S.scorta + (chiaveProfilo === 'magazzino_eccessivo' ? 45 * i + 30 : 0);
      var dso = S.dso + (chiaveProfilo === 'tensione_liquidita' ? 22 * i + 15 : 0);

      n.ricavi = ricavi;
      n.altri_ricavi = ricavi * 0.01;
      var consumi = ricavi * sMat * rumore(0.01);
      n.rimanenze = consumi * scorta / 365;
      n.var_rim_prodotti = 0;
      // gli acquisti sono i consumi più l'aumento delle scorte
      var rimPrec = prec ? prec.rimanenze : n.rimanenze;
      n.var_rim_materie = -(n.rimanenze - rimPrec);
      n.materie = consumi - n.var_rim_materie;
      n.servizi = ricavi * sServ * rumore(0.01);
      if (chiaveProfilo === 'in_perdita') {
        // costi di struttura che non seguono il calo dei ricavi
        if (personaleFisso === null) { personaleFisso = ricavi * sPers; godimentoFisso = ricavi * q.godimento; }
        n.personale = personaleFisso * Math.pow(1.02, i);
        n.godimento = godimentoFisso;
      } else {
        n.personale = ricavi * sPers * rumore(0.01);
        n.godimento = ricavi * q.godimento;
      }
      n.oneri_diversi = ricavi * q.oneri;
      var immTot = immPrec === null ? ricavi * immRatio : null;
      n.ammortamenti = (immPrec === null ? immTot : immPrec) * (S.amm / immRatio);
      if (immPrec !== null) immTot = immPrec - n.ammortamenti + n.ammortamenti * (crescita > 0 ? 1.15 : 0.6);
      n.svalutazioni_acc = ricavi * 0.003;
      n.proventi_fin = 0;
      n.rettifiche_fin = 0;

      n.imm_materiali = immTot * 0.85; n.imm_immateriali = immTot * 0.10; n.imm_finanziarie = immTot * 0.05;
      n.crediti_clienti = ricavi * dso / 365;
      n.altri_crediti = ricavi * 0.02;
      n.attivita_fin_breve = 0;
      n.ratei_attivi = ricavi * 0.003;
      n.debiti_fornitori = (n.materie + n.servizi + n.godimento) * S.dpo / 365;
      n.debiti_tributari = ricavi * 0.03;
      n.altri_debiti = n.personale * 0.12;
      n.ratei_passivi = ricavi * 0.003;
      n.fondi_rischi = ricavi * 0.01;
      n.tfr = n.personale * 0.35;
      n.altri_debiti_fin = 0;

      var ebitdaStima = ricavi * 1.01 - consumi - n.servizi - n.godimento - n.oneri_diversi - n.personale;
      var debitoObiettivo = Math.max(ricavi * 0.05, levaDebito * Math.max(ebitdaStima, ricavi * 0.04));
      var quotaLungo = chiaveProfilo === 'tensione_liquidita' ? Math.max(0.10, 0.40 - 0.15 * i) : 0.65;
      n.debiti_banche_lungo = debitoObiettivo * quotaLungo;
      n.debiti_banche_breve = prec ? prec.debiti_banche_breve : debitoObiettivo * (1 - quotaLungo);
      var debitoPerInteressi = prec ? (prec.debiti_banche_breve + prec.debiti_banche_lungo) : debitoObiettivo;
      n.oneri_fin = debitoPerInteressi * tasso;
      n.quota_capitale = prec ? prec.debiti_banche_lungo * 0.15 : n.debiti_banche_lungo * 0.15;
      n.dipendenti = Math.max(0, Math.round(n.personale / 38000));

      Object.keys(n).forEach(function (k) { n[k] = Math.round(n[k]); });
      // imposte calcolate sui valori arrotondati
      n.imposte = 0;
      var rr = M.riclassifica(n);
      n.imposte = Math.round(Math.max(0, rr.risultato_ante_imposte) * M.ALIQUOTA_IPOTESI);
      rr = M.riclassifica(n);

      var minimoCassa = Math.round(ricavi * (chiaveProfilo === 'tensione_liquidita' ? 0.005 : 0.02));
      n.liquidita = 0;
      if (!prec) {
        // primo anno: la cassa è un obiettivo e il capitale è la voce di chiusura
        n.liquidita = Math.round(ricavi * (chiaveProfilo === 'tensione_liquidita' ? 0.01 : chiaveProfilo === 'sana' ? 0.08 : 0.04));
        n.capitale_riserve = 0;
        rr = M.riclassifica(n);
        n.capitale_riserve = Math.round(rr.totale_attivo - rr.totale_passivo);
        var minimoPatrimonio = Math.round(rr.totale_attivo * 0.08);
        if (n.capitale_riserve + rr.utile < minimoPatrimonio) { // non partire con patrimonio irrealistico: il resto è debito a breve
          var manca = minimoPatrimonio - (n.capitale_riserve + rr.utile);
          n.capitale_riserve += manca; n.debiti_banche_breve -= manca;
          if (n.debiti_banche_breve < 0) { n.liquidita += -n.debiti_banche_breve; n.debiti_banche_breve = 0; }
        }
      } else {
        // anni successivi: il capitale deriva dall'utile trattenuto, la cassa chiude il bilancio
        var trattenuto = precR.utile > 0 ? Math.round(precR.utile * (1 - payout)) : precR.utile;
        n.capitale_riserve = prec.capitale_riserve + trattenuto;
        rr = M.riclassifica(n);
        var cassa = Math.round(rr.totale_passivo - rr.totale_attivo);
        if (cassa < minimoCassa) { n.debiti_banche_breve += (minimoCassa - cassa); cassa = minimoCassa; }
        else if (cassa > ricavi * 0.10 && n.debiti_banche_breve > 0) {
          var rimborso = Math.min(n.debiti_banche_breve, Math.round(cassa - ricavi * 0.10));
          n.debiti_banche_breve -= rimborso; cassa -= rimborso;
        }
        if (cassa > ricavi * 0.10 && chiaveProfilo === 'sovraindebitata') { // la cassa in eccesso esce verso partecipazioni e finanziamenti a terzi
          var esce = Math.round(cassa - ricavi * 0.10); n.imm_finanziarie += esce; cassa -= esce;
        } else if (cassa > ricavi * 0.10 && n.debiti_banche_lungo > 0) { // cassa in eccesso: rimborso anticipato del debito a lungo
          var rimb2 = Math.min(n.debiti_banche_lungo, Math.round(cassa - ricavi * 0.10));
          n.debiti_banche_lungo -= rimb2; cassa -= rimb2;
        }
        n.liquidita = cassa;
      }
      precR = M.riclassifica(n);
      prec = n; immPrec = n.imm_materiali + n.imm_immateriali + n.imm_finanziarie;

      var adesso = new Date().toISOString();
      var valori = {};
      Object.keys(n).forEach(function (k) { valori[k] = { v: n[k], origine: 'simulato', fonte: 'Simulatore · seme ' + seme, acquisito: adesso, stato: 'simulato' }; });
      esercizi[anno] = { valori: valori };
    }

    var classificazione = {};
    M.COSTI_OPERATIVI.forEach(function (k) {
      var qv = (S.quote[k] !== undefined) ? S.quote[k] : M.QUOTE_PREDEFINITE[k];
      classificazione[k] = { quota: qv, confermata: true };
    });
    var nome = NOMI_A[Math.floor(R() * NOMI_A.length)] + ' ' + NOMI_B[Math.floor(R() * NOMI_B.length)] + ' (simulata)';
    return {
      id: 'sim-' + seme + '-' + chiaveSettore + '-' + chiaveProfilo,
      nome: nome, settore: chiaveSettore, forma: chiaveSettore === 'professionista' ? 'Libero professionista' : 'SRL', ateco: '',
      simulata: true, simulazione: { seme: seme, settore: chiaveSettore, profilo: chiaveProfilo, ricavi: ricaviBase, anni: anni },
      esercizi: esercizi, classificazione: classificazione, budget: {}, scenari: {}, storico: []
    };
  }

  function serieDi(azienda) {
    return Object.keys(azienda.esercizi).map(Number).sort(function (a, b) { return a - b; })
      .map(function (a) { return { anno: a, n: M.numeri(azienda.esercizi[a]) }; });
  }

  /* Collaudo completo: controlli di coerenza + (per le aziende simulate) verifica che
     la diagnosi trovi i problemi che il profilo ha introdotto di proposito. */
  function collauda(azienda) {
    var serie = serieDi(azienda);
    var esiti = M.collaudo(serie, azienda.classificazione);
    var d = M.diagnosi(serie, azienda.classificazione);
    var sim = azienda.simulazione;
    if (azienda.simulata && sim && PROFILI[sim.profilo]) {
      var P = PROFILI[sim.profilo], trovati = d.map(function (x) { return x.id; });
      P.atteso.forEach(function (id) {
        esiti.push({ nome: 'Diagnosi · il problema introdotto viene riconosciuto (' + id + ')', ok: trovati.indexOf(id) >= 0, dettaglio: 'Criticità trovate: ' + (trovati.join(', ') || 'nessuna') });
      });
      if (P.nessunRosso) {
        var rossi = d.filter(function (x) { return x.gravita === 'rosso'; }).map(function (x) { return x.id; });
        esiti.push({ nome: 'Diagnosi · nessun falso allarme grave su un\'azienda in equilibrio', ok: rossi.length === 0, dettaglio: rossi.length ? 'Allarmi: ' + rossi.join(', ') : 'Nessuna criticità grave' });
      }
    }
    return { esiti: esiti, superati: esiti.filter(function (e) { return e.ok; }).length, totale: esiti.length, diagnosi: d };
  }

  /* Collaudo massivo: tutte le combinazioni settore × profilo per più semi. */
  function collaudoMassivo(semi) {
    semi = semi || 5;
    var tot = 0, ok = 0, falliti = [];
    Object.keys(SETTORI).forEach(function (s) {
      Object.keys(PROFILI).forEach(function (p) {
        for (var k = 1; k <= semi; k++) {
          var c = collauda(genera({ settore: s, profilo: p, seme: k * 7919, anni: 4 }));
          tot += c.totale; ok += c.superati;
          c.esiti.filter(function (e) { return !e.ok; }).forEach(function (e) { falliti.push({ settore: s, profilo: p, seme: k * 7919, nome: e.nome, dettaglio: e.dettaglio }); });
        }
      });
    });
    return { aziende: Object.keys(SETTORI).length * Object.keys(PROFILI).length * semi, totale: tot, superati: ok, falliti: falliti };
  }

  return { SETTORI: SETTORI, PROFILI: PROFILI, genera: genera, serieDi: serieDi, collauda: collauda, collaudoMassivo: collaudoMassivo };
});
