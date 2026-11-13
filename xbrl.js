/* Timone · lettura dei bilanci XBRL depositati al Registro delle Imprese
   Tassonomia "Principi Contabili Italiani" (itcc-ci), forme ordinaria, abbreviata e micro.
   Accetta il file .xbrl / .xml e anche la versione firmata digitalmente (.p7m, binaria o base64).

   Principi:
   - si leggono solo i prospetti (contesti senza dimensioni); le tabelle di nota integrativa sono ignorate;
   - ogni voce di Timone indica gli elementi XBRL da cui deriva;
   - una voce assente nel file vale zero SOLO se i totali ufficiali della sezione quadrano;
   - quando il bilancio aggrega (es. abbreviato: debiti in un'unica voce) la ripartizione non viene
     indovinata: si crea un "vincolo" con il totale ufficiale, da ripartire a cura dell'utente. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motore.js'));
  else root.Xbrl = factory(root.Motore);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  // ------------------------------------------------------------ byte e firma digitale
  function daTesto(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
  function utf8(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    return Buffer.from(bytes).toString('utf8');
  }
  function inizioXml(b) {
    var i = 0;
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) i = 3;
    while (i < b.length && (b[i] === 0x20 || b[i] === 0x0A || b[i] === 0x0D || b[i] === 0x09)) i++;
    return b[i] === 0x3C; // "<"
  }
  function base64(s) {
    s = s.replace(/-----[^-]+-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (typeof atob === 'function') return daTesto(atob(s));
    return new Uint8Array(Buffer.from(s, 'base64'));
  }

  // Lettura minima ASN.1 BER/DER: raccoglie il contenuto degli OCTET STRING (anche "a pezzi").
  function ottetti(b) {
    var trovati = [];
    function lunghezza(p) {
      var l = b[p];
      if (l < 0x80) return { l: l, p: p + 1 };
      if (l === 0x80) return { l: -1, p: p + 1 }; // lunghezza indefinita
      var n = l & 0x7f, v = 0;
      if (n > 4) throw new Error('lunghezza ASN.1 non gestita');
      for (var i = 0; i < n; i++) v = v * 256 + b[p + 1 + i];
      return { l: v, p: p + 1 + n };
    }
    // restituisce la posizione dopo l'elemento; se è un OCTET STRING ne accumula i byte in "acc"
    function elemento(p, fine, acc) {
      var tag = b[p], costruito = (tag & 0x20) !== 0, numero = tag & 0x1f;
      if (numero === 0x1f) { p++; while (b[p] & 0x80) p++; }
      var L = lunghezza(p + 1), q = L.p;
      var stop = L.l >= 0 ? q + L.l : fine;
      if (L.l >= 0 && stop > fine) throw new Error('struttura ASN.1 non valida');
      var ottetto = (tag & 0xdf) === 0x04;
      if (!costruito) {
        if (ottetto) { if (acc) acc.push(b.subarray(q, stop)); else trovati.push([b.subarray(q, stop)]); }
        return stop;
      }
      var mio = ottetto ? (acc || []) : null;
      while (q < stop) {
        if (L.l < 0 && b[q] === 0 && b[q + 1] === 0) { q += 2; break; }
        q = elemento(q, stop, mio);
      }
      if (ottetto && !acc) trovati.push(mio);
      return L.l >= 0 ? stop : q;
    }
    elemento(0, b.length, null);
    return trovati.map(function (pezzi) {
      var n = 0; pezzi.forEach(function (x) { n += x.length; });
      var u = new Uint8Array(n), o = 0; pezzi.forEach(function (x) { u.set(x, o); o += x.length; });
      return u;
    });
  }

  // da qualsiasi input (stringa, ArrayBuffer, Uint8Array) al testo XML dell'istanza
  function estraiXml(input) {
    var b = typeof input === 'string' ? null : (input instanceof Uint8Array ? input : new Uint8Array(input));
    if (b === null) {
      if (/^\s*</.test(input)) return { xml: input, firmato: false };
      b = base64(input);
    } else if (inizioXml(b)) return { xml: utf8(b), firmato: false };
    else if (b[0] !== 0x30) { // potrebbe essere un p7m in base64
      var t = utf8(b.subarray(0, 64));
      if (/^\s*(-----BEGIN|MI)/.test(t)) b = base64(utf8(b));
    }
    if (b[0] !== 0x30) throw new Error('Il file non è un XBRL né un file firmato .p7m riconoscibile.');
    var candidati = ottetti(b).filter(function (u) { return u.length > 100 && inizioXml(u); });
    if (!candidati.length) throw new Error('File firmato: non trovo un documento XML al suo interno.');
    candidati.sort(function (a, c) { return c.length - a.length; });
    var annidato = candidati[0];
    // firma su firma (p7m di un p7m)
    if (!inizioXml(annidato)) return estraiXml(annidato);
    return { xml: utf8(annidato), firmato: true };
  }

  // ------------------------------------------------------------ istanza XBRL
  function entita(s) {
    return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function attr(s, nome) { var m = new RegExp('(?:^|\\s)' + nome + '\\s*=\\s*"([^"]*)"').exec(s) || new RegExp('(?:^|\\s)' + nome + "\\s*=\\s*'([^']*)'").exec(s); return m ? m[1] : null; }

  function istanza(xml) {
    xml = xml.replace(/<!--[\s\S]*?-->/g, '');
    var radice = /<((?:[\w.-]+:)?xbrl)\b([^>]*)>/.exec(xml);
    if (!radice) throw new Error('Il file non contiene un\'istanza XBRL (manca l\'elemento <xbrl>).');
    var ns = {}, m, reNs = /xmlns(?::([\w.-]+))?\s*=\s*"([^"]*)"/g;
    while ((m = reNs.exec(radice[2]))) ns[m[1] || ''] = m[2];
    var schema = (/<(?:[\w.-]+:)?schemaRef\b([^>]*)>/.exec(xml) || [])[1];
    schema = schema ? (attr(schema, 'xlink:href') || '') : '';

    var contesti = {}, reCtx = /<(?:[\w.-]+:)?context\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?context>/g;
    while ((m = reCtx.exec(xml))) {
      var id = attr(m[1], 'id'), c = m[2];
      var ist = /<(?:[\w.-]+:)?instant>\s*([\d-]+)/.exec(c), fin = /<(?:[\w.-]+:)?endDate>\s*([\d-]+)/.exec(c), ini = /<(?:[\w.-]+:)?startDate>\s*([\d-]+)/.exec(c);
      contesti[id] = {
        id: id, istante: ist ? ist[1] : null, inizio: ini ? ini[1] : null, fine: fin ? fin[1] : null,
        dimensioni: /<(?:[\w.-]+:)?(segment|scenario)\b/.test(c)
      };
    }
    // fatti: elementi con contextRef nei namespace della tassonomia italiana
    var fatti = [], reF = /<([\w.-]+):([\w.-]+)\b([^>]*?\bcontextRef\s*=\s*["'][^"']*["'][^>]*?)(\/>|>([\s\S]*?)<\/\1:\2\s*>)/g;
    while ((m = reF.exec(xml))) {
      var uri = ns[m[1]] || '';
      if (!/infocamere\.it\/itnn\/fr\/itcc\/ci/.test(uri)) continue;
      var a = m[3];
      if (/\bxsi:nil\s*=\s*["']true/.test(a)) continue;
      fatti.push({ nome: m[2], ctx: attr(a, 'contextRef'), unita: attr(a, 'unitRef'), testo: m[5] === undefined ? '' : entita(m[5]).trim() });
    }
    return { ns: ns, schema: schema, contesti: contesti, fatti: fatti };
  }

  function forma(schema, ns) {
    var s = (schema || '') + ' ' + Object.keys(ns).map(function (k) { return ns[k]; }).join(' ');
    var ver = (/(20\d\d-\d\d-\d\d)/.exec(schema) || /itcc\/ci\/(?:\w+\/)?(20\d\d-\d\d-\d\d)/.exec(s) || [])[1] || '';
    var tipo = /micr/i.test(schema) ? 'micro' : /-abb-|abbreviat/i.test(schema) ? 'abbreviato' : /consolid|-cons-/i.test(schema) ? 'consolidato' : 'ordinario';
    return { tipo: tipo, versione: ver };
  }

  // ------------------------------------------------------------ mappatura
  // Ogni regola restituisce {v, elementi} oppure null se nessun elemento è presente.
  function cercatore(dati) {
    var nomi = Object.keys(dati);
    function uno(nome) { return dati[nome] !== undefined ? { v: dati[nome], elementi: [nome] } : null; }
    function primo(lista) { for (var i = 0; i < lista.length; i++) { var x = uno(lista[i]); if (x) return x; } return null; }
    function somma(lista) {
      var tot = 0, el = [];
      lista.forEach(function (x) { if (x) { tot += x.v; el = el.concat(x.elementi); } });
      return el.length ? { v: tot, elementi: el } : null;
    }
    function regex(re, escludi) {
      return somma(nomi.filter(function (n) { return re.test(n) && !(escludi && escludi.test(n)); }).map(uno));
    }
    return { uno: uno, primo: primo, somma: somma, regex: regex, nomi: nomi };
  }

  // debito o credito di una categoria: preferisce il totale, altrimenti entro + oltre
  function categoria(C, base) {
    var tot = C.regex(new RegExp('^' + base + '(?!Esigibili).*Totale'));
    var entro = C.regex(new RegExp('^' + base + 'EsigibiliEntro'));
    var oltre = C.regex(new RegExp('^' + base + 'EsigibiliOltre'));
    if (!tot) tot = C.somma([entro, oltre]);
    return { tot: tot, entro: entro, oltre: oltre };
  }

  var CAT_DEBITI_FIN = ['DebitiObbligazioni(?!Convertibili)', 'DebitiObbligazioniConvertibili', 'Debiti(?:Debiti)?VersoSociFinanziamenti', 'Debiti(?:Debiti)?VersoAltriFinanziatori', 'Debiti(?:Debiti)?RappresentatiTitoliCredito'];

  function mappaCE(C) {
    var v = {};
    v.ricavi = C.uno('ValoreProduzioneRicaviVenditePrestazioni');
    v.var_rim_prodotti = C.regex(/^ValoreProduzioneVariazioni/);
    v.altri_ricavi = C.somma([C.uno('ValoreProduzioneIncrementiImmobilizzazioniLavoriInterni'),
      C.primo(['ValoreProduzioneAltriRicaviProventiTotaleAltriRicaviProventi']) || C.somma([C.uno('ValoreProduzioneAltriRicaviProventiContributiContoEsercizio'), C.uno('ValoreProduzioneAltriRicaviProventiAltri')])]);
    v.materie = C.uno('CostiProduzioneMateriePrimeSussidiarieConsumoMerci');
    v.var_rim_materie = C.regex(/^CostiProduzioneVariazioniRimanenze/);
    v.servizi = C.uno('CostiProduzioneServizi');
    v.godimento = C.uno('CostiProduzioneGodimentoBeniTerzi');
    v.personale = C.uno('CostiProduzionePersonaleTotaleCostiPersonale') ||
      C.regex(/^CostiProduzionePersonale/, /Totale|TrattamentoFineRapportoTrattamentoQuiescenzaAltriCostiPersonale$/) ;
    if (!C.uno('CostiProduzionePersonaleTotaleCostiPersonale') && C.uno('CostiProduzionePersonaleTrattamentoFineRapportoTrattamentoQuiescenzaAltriCostiPersonale'))
      v.personale = C.somma([C.uno('CostiProduzionePersonaleSalariStipendi'), C.uno('CostiProduzionePersonaleOneriSociali'), C.uno('CostiProduzionePersonaleTrattamentoFineRapportoTrattamentoQuiescenzaAltriCostiPersonale')]);
    // ammortamenti: a) + b) separati, oppure a+b+c aggregati (forma abbreviata), oppure solo il totale
    var amm = C.somma([C.uno('CostiProduzioneAmmortamentiSvalutazioniAmmortamentoImmobilizzazioniImmateriali'), C.uno('CostiProduzioneAmmortamentiSvalutazioniAmmortamentoImmobilizzazioniMateriali')]);
    var abc = C.uno('CostiProduzioneAmmortamentiSvalutazioniAmmortamentoImmobilizzazioniImmaterialiMaterialiAltreSvalutazioniImmobilizzazioni');
    var altreSval = C.uno('CostiProduzioneAmmortamentiSvalutazioniAltreSvalutazioniImmobilizzazioni');
    var svalCrediti = C.uno('CostiProduzioneAmmortamentiSvalutazioniSvalutazioniCreditiCompresiAttivoCircolanteDisponibilitaLiquide');
    var totAmm = C.uno('CostiProduzioneAmmortamentiSvalutazioniTotaleAmmortamentiSvalutazioni');
    var note = {};
    if (amm) v.ammortamenti = amm;
    else if (abc) { v.ammortamenti = abc; altreSval = null; note.ammortamenti = 'Nella forma abbreviata comprende anche le svalutazioni delle immobilizzazioni.'; }
    else if (totAmm) { v.ammortamenti = { v: totAmm.v - (svalCrediti ? svalCrediti.v : 0), elementi: totAmm.elementi.concat(svalCrediti ? svalCrediti.elementi : []) }; note.ammortamenti = 'Ricavato dal totale ammortamenti e svalutazioni: può comprendere svalutazioni delle immobilizzazioni.'; }
    v.svalutazioni_acc = C.somma([altreSval, svalCrediti, C.uno('CostiProduzioneAccantonamentiRischi'), C.uno('CostiProduzioneAltriAccantonamenti')]);
    v.oneri_diversi = C.uno('CostiProduzioneOneriDiversiGestione');
    // gestione finanziaria: interessi passivi separati; i proventi sono il resto del totale ufficiale (cambi compresi)
    v.oneri_fin = C.uno('ProventiOneriFinanziariInteressiAltriOneriFinanziariTotaleInteressiAltriOneriFinanziari') ||
      C.regex(/^ProventiOneriFinanziariInteressiAltriOneriFinanziari/, /Totale/);
    var totFin = C.uno('TotaleProventiOneriFinanziari');
    if (totFin) { v.proventi_fin = { v: totFin.v + (v.oneri_fin ? v.oneri_fin.v : 0), elementi: totFin.elementi.concat(v.oneri_fin ? v.oneri_fin.elementi : []) }; note.proventi_fin = 'Totale proventi e oneri finanziari più gli interessi passivi: comprende utili e perdite su cambi.'; }
    else v.proventi_fin = C.somma([C.uno('ProventiOneriFinanziariProventiPartecipazioniTotaleProventiPartecipazioni'), C.uno('ProventiOneriFinanziariAltriProventiFinanziariTotaleAltriProventiFinanziari'), C.uno('ProventiOneriFinanziariUtiliPerditeCambi')]);
    v.rettifiche_fin = C.uno('TotaleRettificheValoreAttivitaPassivitaFinanziarie') ||
      (function () { var r = C.uno('RettificheValoreAttivitaPassivitaFinanziarieRivalutazioniTotaleRivalutazioni'), s = C.uno('RettificheValoreAttivitaPassivitaFinanziarieSvalutazioniTotaleSvalutazioni'); return (r || s) ? { v: (r ? r.v : 0) - (s ? s.v : 0), elementi: [].concat(r ? r.elementi : [], s ? s.elementi : []) } : null; })();
    v.imposte = C.uno('ImposteRedditoEsercizioCorrentiDifferiteAnticipateTotaleImposteRedditoEsercizioCorrentiDifferiteAnticipate') ||
      C.regex(/^ImposteRedditoEsercizioCorrentiDifferiteAnticipate/, /Totale/);
    return { v: v, note: note };
  }

  function mappaSP(C, ce) {
    var v = {}, note = {}, vincoli = [];
    var imm = { imm_immateriali: C.uno('TotaleImmobilizzazioniImmateriali'), imm_materiali: C.uno('TotaleImmobilizzazioniMateriali'), imm_finanziarie: C.uno('TotaleImmobilizzazioniFinanziarie') };
    var totImm = C.uno('TotaleImmobilizzazioni');
    var noti = Object.keys(imm).filter(function (k) { return imm[k]; });
    if (totImm && noti.length < 3) {
      var resto = totImm.v - noti.reduce(function (s, k) { return s + imm[k].v; }, 0);
      var vuote = Object.keys(imm).filter(function (k) { return !imm[k]; });
      if (Math.abs(resto) < 0.5) vuote.forEach(function (k) { imm[k] = { v: 0, elementi: totImm.elementi, zero: true }; });
      else if (vuote.length === 1) { imm[vuote[0]] = { v: resto, elementi: totImm.elementi.concat(noti.map(function (k) { return imm[k].elementi[0]; })) }; note[vuote[0]] = 'Ricavato per differenza dal totale delle immobilizzazioni.'; }
      else {
        imm.imm_materiali = { v: resto, elementi: totImm.elementi }; note.imm_materiali = 'Il bilancio non separa materiali e immateriali: l\'importo comprende entrambe.';
        vuote.forEach(function (k) { if (k !== 'imm_materiali') imm[k] = { v: 0, elementi: totImm.elementi, zero: true }; });
      }
    }
    Object.keys(imm).forEach(function (k) { v[k] = imm[k]; });

    var versoSoci = C.uno('TotaleCreditiVersoSociVersamentiAncoraDovuti') || C.regex(/^CreditiVersoSociVersamentiAncoraDovuti/);
    v.rimanenze = C.uno('TotaleRimanenze') || C.regex(/^Rimanenze/);
    var totCrediti = C.uno('TotaleCrediti');
    var clienti = categoria(C, 'CreditiVersoClienti').tot;
    if (clienti) {
      v.crediti_clienti = clienti;
      if (totCrediti) v.altri_crediti = { v: totCrediti.v - clienti.v + (versoSoci ? versoSoci.v : 0), elementi: totCrediti.elementi.concat(clienti.elementi, versoSoci ? versoSoci.elementi : []) };
      note.altri_crediti = 'Totale crediti meno crediti verso clienti' + (versoSoci ? ', più crediti verso soci per versamenti dovuti.' : '.');
    } else if (totCrediti) {
      var ce1 = C.uno('CreditiEsigibiliEntroEsercizioSuccessivo'), co1 = C.uno('CreditiEsigibiliOltreEsercizioSuccessivo');
      vincoli.push({ gruppo: 'crediti', titolo: 'Crediti (C.II)', totale: totCrediti.v + (versoSoci ? versoSoci.v : 0), entro: ce1 ? ce1.v : null, oltre: co1 ? co1.v : null,
        voci: ['crediti_clienti', 'altri_crediti'], elementi: totCrediti.elementi,
        testo: 'Il bilancio indica i crediti in un\'unica voce' + (versoSoci ? ' (compresi i crediti verso soci)' : '') + ': vanno ripartiti tra clienti e altri crediti, ad esempio con il bilancio di verifica.' });
    }
    v.attivita_fin_breve = C.primo(['TotaleAttivitaFinanziarieNonCostituisconoImmobilizzazioni', 'AttivitaFinanziarieNonCostituisconoImmobilizzazioni']) ||
      C.regex(/^AttivitaFinanziarieNonCostituisconoImmobilizzazioni/);
    v.liquidita = C.uno('TotaleDisponibilitaLiquide') || C.regex(/^DisponibilitaLiquide/);
    v.ratei_attivi = C.uno('AttivoRateiRisconti');

    var utileSp = C.uno('PatrimonioNettoUtilePerditaEsercizio') || C.uno('UtilePerditaEsercizio');
    var totPN = C.uno('TotalePatrimonioNetto');
    if (totPN) { v.capitale_riserve = { v: totPN.v - (utileSp ? utileSp.v : 0), elementi: totPN.elementi.concat(utileSp ? utileSp.elementi : []) }; note.capitale_riserve = 'Patrimonio netto meno l\'utile (o la perdita) dell\'esercizio.'; }
    v.fondi_rischi = C.uno('TotaleFondiRischiOneri') || C.regex(/^FondiRischiOneri/);
    v.tfr = C.uno('TrattamentoFineRapportoLavoroSubordinato');

    var totDebiti = C.uno('TotaleDebiti');
    var banche = categoria(C, 'Debiti(?:Debiti)?VersoBanche');
    var fornitori = categoria(C, 'Debiti(?:Debiti)?VersoFornitori');
    var dettaglio = banche.tot || fornitori.tot || C.nomi.some(function (n) { return /^Debiti(Debiti)?(Verso|Tributari|Obbligazioni|Acconti|AltriDebiti|Rappresentati)/.test(n); });
    if (dettaglio) {
      if (banche.entro || banche.oltre) { v.debiti_banche_breve = banche.entro || { v: 0, elementi: banche.tot.elementi, zero: true }; v.debiti_banche_lungo = banche.oltre || { v: 0, elementi: banche.tot.elementi, zero: true }; }
      else if (banche.tot) { v.debiti_banche_breve = banche.tot; v.debiti_banche_lungo = { v: 0, elementi: banche.tot.elementi, zero: true }; note.debiti_banche_breve = 'Il file non indica la scadenza dei debiti verso banche: considerati tutti entro 12 mesi.'; }
      v.altri_debiti_fin = C.somma(CAT_DEBITI_FIN.map(function (b) { return categoria(C, b).tot; }));
      v.debiti_fornitori = fornitori.tot;
      v.debiti_tributari = C.somma([categoria(C, 'Debiti(?:Debiti)?Tributari').tot, categoria(C, 'Debiti(?:Debiti)?VersoIstitutiPrevidenzaSicurezzaSociale').tot]);
      if (totDebiti) {
        var noti2 = ['debiti_banche_breve', 'debiti_banche_lungo', 'altri_debiti_fin', 'debiti_fornitori', 'debiti_tributari'].reduce(function (s, k) { return s + (v[k] ? v[k].v : 0); }, 0);
        v.altri_debiti = { v: totDebiti.v - noti2, elementi: totDebiti.elementi };
        note.altri_debiti = 'Totale debiti meno banche, finanziatori, fornitori, tributari e previdenziali: comprende acconti, debiti verso imprese del gruppo e altri debiti.';
      }
    } else if (totDebiti) {
      var de = C.uno('DebitiEsigibiliEntroEsercizioSuccessivo'), dol = C.uno('DebitiEsigibiliOltreEsercizioSuccessivo');
      vincoli.push({ gruppo: 'debiti', titolo: 'Debiti (D)', totale: totDebiti.v, entro: de ? de.v : null, oltre: dol ? dol.v : null,
        voci: ['debiti_banche_breve', 'debiti_banche_lungo', 'altri_debiti_fin', 'debiti_fornitori', 'debiti_tributari', 'altri_debiti'], elementi: totDebiti.elementi,
        testo: 'Il bilancio indica i debiti in un\'unica voce: vanno ripartiti tra banche, fornitori, tributari e altri. Senza questa ripartizione posizione finanziaria netta, liquidità e diagnosi non sono calcolabili.' });
    }
    v.ratei_passivi = C.uno('PassivoRateiRisconti');
    return { v: v, note: note, vincoli: vincoli };
  }

  function arr(x) { return Math.round(x * 100) / 100; }

  // ------------------------------------------------------------ lettura completa
  function leggi(input) {
    var e = estraiXml(input), ist = istanza(e.xml), f = forma(ist.schema, ist.ns);
    var avvisi = [];
    if (e.firmato) avvisi.push({ tipo: 'info', testo: 'File con firma digitale: il bilancio è stato estratto dalla busta .p7m (la validità della firma non viene verificata).' });
    if (f.tipo === 'consolidato') avvisi.push({ tipo: 'giallo', testo: 'Sembra un bilancio consolidato: i valori riguardano il gruppo, non la sola società.' });
    if (f.versione && f.versione < '2016-11-14') avvisi.push({ tipo: 'giallo', testo: 'Tassonomia ' + f.versione + ', anteriore alla riforma del 2016: la gestione straordinaria, se presente, non ha una voce corrispondente e va verificata.' });

    // anagrafica (contesti senza dimensioni)
    var anag = {};
    ist.fatti.forEach(function (x) {
      var c = ist.contesti[x.ctx]; if (!c || c.dimensioni) return;
      if (/^DatiAnagrafici/.test(x.nome) && !anag[x.nome]) anag[x.nome] = x.testo;
    });
    var anagrafica = {
      denominazione: anag.DatiAnagraficiDenominazione || '', codiceFiscale: anag.DatiAnagraficiCodiceFiscale || '',
      sede: anag.DatiAnagraficiSede || '', forma: (anag.DatiAnagraficiFormaGiuridica || '').replace(/&#39;/g, "'"),
      ateco: anag.DatiAnagraficiSettoreAttivitaPrevalenteAteco || ''
    };

    // valori numerici per anno: CE dai periodi, SP dalle date puntuali
    var ce = {}, sp = {}, scartati = 0;
    ist.fatti.forEach(function (x) {
      var c = ist.contesti[x.ctx]; if (!c) return;
      if (c.dimensioni) { scartati++; return; }
      if (!x.unita) return;
      var n = Number(x.testo); if (!isFinite(n) || x.testo === '') return;
      var data = c.istante || c.fine; if (!data) return;
      var anno = Number(data.slice(0, 4)), dest = c.istante ? sp : ce;
      dest[anno] = dest[anno] || {};
      if (dest[anno][x.nome] === undefined) dest[anno][x.nome] = n;
    });
    var anni = Object.keys(ce).concat(Object.keys(sp)).map(Number).filter(function (a, i, s) { return s.indexOf(a) === i; }).sort();
    // solo gli anni con almeno conto economico o stato patrimoniale significativi
    anni = anni.filter(function (a) { return (ce[a] && ce[a].TotaleValoreProduzione !== undefined) || (sp[a] && (sp[a].TotaleAttivo !== undefined || sp[a].TotalePassivo !== undefined)); });
    if (!anni.length) throw new Error('Nel file non ci sono prospetti di bilancio leggibili (conto economico o stato patrimoniale).');

    var perAnno = {};
    anni.forEach(function (anno) {
      var Cce = cercatore(ce[anno] || {}), Csp = cercatore(sp[anno] || {});
      var mce = mappaCE(Cce), msp = mappaSP(Csp, mce);
      var val = {}, note = Object.assign({}, mce.note, msp.note), controlli = [];
      Object.keys(mce.v).forEach(function (k) { if (mce.v[k] && (ce[anno])) val[k] = mce.v[k]; });
      Object.keys(msp.v).forEach(function (k) { if (msp.v[k] && (sp[anno])) val[k] = msp.v[k]; });
      Object.keys(val).forEach(function (k) { val[k] = { v: arr(val[k].v), elementi: val[k].elementi, zero: !!val[k].zero }; });

      function ctl(nome, ok, dettaglio) { controlli.push({ nome: nome, ok: ok, dettaglio: dettaglio }); return ok; }
      function g(k) { return val[k] ? val[k].v : 0; }
      function eur(x) { return M.fmt.eur(x); }
      var vociCE = M.VOCI.filter(function (x) { return x.tipo === 'ce'; }).map(function (x) { return x.id; });
      var vociSP = M.VOCI.filter(function (x) { return x.tipo === 'att' || x.tipo === 'pas'; }).map(function (x) { return x.id; });
      var inVincolo = []; msp.vincoli.forEach(function (w) { inVincolo = inVincolo.concat(w.voci); });

      // conto economico: le voci assenti valgono zero solo se i totali ufficiali quadrano
      var okCE = false;
      if (ce[anno]) {
        var T = ce[anno];
        var vp = g('ricavi') + g('var_rim_prodotti') + g('altri_ricavi');
        var cp = g('materie') + g('var_rim_materie') + g('servizi') + g('godimento') + g('personale') + g('ammortamenti') + g('svalutazioni_acc') + g('oneri_diversi');
        var fin = g('proventi_fin') - g('oneri_fin') + g('rettifiche_fin');
        var utile = vp - cp + fin - g('imposte');
        var a = T.TotaleValoreProduzione === undefined || ctl('Valore della produzione = totale A del bilancio', Math.abs(vp - T.TotaleValoreProduzione) < 1, 'Calcolato ' + eur(vp) + ', nel file ' + eur(T.TotaleValoreProduzione));
        var b = T.TotaleCostiProduzione === undefined || ctl('Costi della produzione = totale B del bilancio', Math.abs(cp - T.TotaleCostiProduzione) < 1, 'Calcolato ' + eur(cp) + ', nel file ' + eur(T.TotaleCostiProduzione));
        var c = T.RisultatoPrimaImposte === undefined || ctl('Risultato prima delle imposte', Math.abs(vp - cp + fin - T.RisultatoPrimaImposte) < 1, 'Calcolato ' + eur(vp - cp + fin) + ', nel file ' + eur(T.RisultatoPrimaImposte));
        var ufile = T.UtilePerditaEsercizio;
        var d = ufile === undefined ? ctl('Utile dell\'esercizio presente nel file', false, 'Elemento UtilePerditaEsercizio assente') : ctl('Utile (perdita) dell\'esercizio', Math.abs(utile - ufile) < 1, 'Calcolato ' + eur(utile) + ', nel file ' + eur(ufile));
        okCE = a && b && c && d && T.TotaleValoreProduzione !== undefined && T.TotaleCostiProduzione !== undefined;
        vociCE.forEach(function (k) {
          if (val[k]) return;
          if (okCE) { val[k] = { v: 0, elementi: [], zero: true }; }
        });
      }
      // stato patrimoniale
      if (sp[anno]) {
        var S = sp[anno];
        var att = ['imm_immateriali', 'imm_materiali', 'imm_finanziarie', 'rimanenze', 'crediti_clienti', 'altri_crediti', 'attivita_fin_breve', 'liquidita', 'ratei_attivi'].reduce(function (s, k) { return s + g(k); }, 0);
        var pas = ['capitale_riserve', 'fondi_rischi', 'tfr', 'debiti_banche_breve', 'debiti_banche_lungo', 'altri_debiti_fin', 'debiti_fornitori', 'debiti_tributari', 'altri_debiti', 'ratei_passivi'].reduce(function (s, k) { return s + g(k); }, 0);
        var utileAnno = (sp[anno].PatrimonioNettoUtilePerditaEsercizio !== undefined) ? sp[anno].PatrimonioNettoUtilePerditaEsercizio : (ce[anno] && ce[anno].UtilePerditaEsercizio !== undefined ? ce[anno].UtilePerditaEsercizio : 0);
        var w0 = msp.vincoli.reduce(function (s, w) { return s + (w.gruppo === 'crediti' ? w.totale : 0); }, 0);
        var w1 = msp.vincoli.reduce(function (s, w) { return s + (w.gruppo === 'debiti' ? w.totale : 0); }, 0);
        var okA = S.TotaleAttivo === undefined ? false : ctl('Totale attivo', Math.abs(att + w0 - S.TotaleAttivo) < 1, 'Calcolato ' + eur(att + w0) + ', nel file ' + eur(S.TotaleAttivo));
        var okP = S.TotalePassivo === undefined ? false : ctl('Totale passivo e patrimonio netto', Math.abs(pas + utileAnno + w1 - S.TotalePassivo) < 1, 'Calcolato ' + eur(pas + utileAnno + w1) + ', nel file ' + eur(S.TotalePassivo));
        if (S.TotaleAttivo !== undefined && S.TotalePassivo !== undefined) ctl('Attivo = passivo nel file', Math.abs(S.TotaleAttivo - S.TotalePassivo) < 1, eur(S.TotaleAttivo) + ' / ' + eur(S.TotalePassivo));
        if (ce[anno] && ce[anno].UtilePerditaEsercizio !== undefined && S.PatrimonioNettoUtilePerditaEsercizio !== undefined)
          ctl('Utile del conto economico = utile nel patrimonio netto', Math.abs(ce[anno].UtilePerditaEsercizio - S.PatrimonioNettoUtilePerditaEsercizio) < 1, eur(ce[anno].UtilePerditaEsercizio) + ' / ' + eur(S.PatrimonioNettoUtilePerditaEsercizio));
        if (okA) vociSP.filter(function (k) { return M.VOCE[k].tipo === 'att'; }).forEach(function (k) { if (!val[k] && inVincolo.indexOf(k) < 0) val[k] = { v: 0, elementi: [], zero: true }; });
        if (okP) vociSP.filter(function (k) { return M.VOCE[k].tipo === 'pas'; }).forEach(function (k) { if (!val[k] && inVincolo.indexOf(k) < 0) val[k] = { v: 0, elementi: [], zero: true }; });
      }
      perAnno[anno] = { valori: val, note: note, controlli: controlli, vincoli: msp.vincoli, haCE: !!ce[anno], haSP: !!sp[anno] };
    });
    if (scartati) avvisi.push({ tipo: 'info', testo: scartati + ' valori delle tabelle di nota integrativa non sono stati letti: Timone usa solo i prospetti di bilancio.' });
    var ko = 0; anni.forEach(function (a) { ko += perAnno[a].controlli.filter(function (c) { return !c.ok; }).length; });
    if (ko) avvisi.push({ tipo: 'rosso', testo: ko + ' controlli sui totali ufficiali non superati: le voci coinvolte vanno verificate prima di usare le analisi.' });
    return { forma: f, schema: ist.schema, anagrafica: anagrafica, anni: anni, perAnno: perAnno, avvisi: avvisi, firmato: e.firmato };
  }

  // converte la lettura nella struttura di anteprima usata da importa.js
  function righeImport(r, nomeFile) {
    var etichette = { ordinario: 'ordinario', abbreviato: 'in forma abbreviata', micro: 'micro-impresa', consolidato: 'consolidato' };
    var righe = [];
    M.VOCI.forEach(function (voce) {
      var valori = {}, elementi = [], zero = true, presente = false, note = [];
      r.anni.forEach(function (a) {
        var x = r.perAnno[a].valori[voce.id]; if (!x) return;
        presente = true; valori[a] = x.v; if (!x.zero) zero = false;
        x.elementi.forEach(function (e) { if (elementi.indexOf(e) < 0) elementi.push(e); });
        if (r.perAnno[a].note[voce.id] && note.indexOf(r.perAnno[a].note[voce.id]) < 0) note.push(r.perAnno[a].note[voce.id]);
      });
      if (!presente) return;
      righe.push({ etichetta: voce.nome, voce: voce.id, valori: valori, elementi: elementi, zero: zero, nota: note.join(' '),
        fonte: 'XBRL ' + nomeFile + (elementi.length ? ' · ' + elementi.slice(0, 3).join(' + ') + (elementi.length > 3 ? '…' : '') : ' · voce assente nel file, totali ufficiali quadrati') });
    });
    var vincoli = {}; r.anni.forEach(function (a) { if (r.perAnno[a].vincoli.length) vincoli[a] = r.perAnno[a].vincoli; });
    var controlli = {}; r.anni.forEach(function (a) { controlli[a] = r.perAnno[a].controlli; });
    return {
      tipo: 'xbrl', nome: nomeFile, anni: r.anni, righe: righe, controlli: controlli, vincoli: vincoli, anagrafica: r.anagrafica,
      descrizione: 'Bilancio ' + (etichette[r.forma.tipo] || '') + (r.forma.versione ? ' · tassonomia ' + r.forma.versione : '') + (r.firmato ? ' · firmato digitalmente' : ''),
      avvisi: r.avvisi.map(function (x) { return x.testo; }), livelli: r.avvisi.map(function (x) { return x.tipo; })
    };
  }

  return { leggi: leggi, righeImport: righeImport, estraiXml: estraiXml, istanza: istanza };
});
