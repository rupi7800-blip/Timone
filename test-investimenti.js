/* Test del modulo Investimenti.  Avvio:  node test-investimenti.js */
const M = require('./motore.js'), S = require('./simulatore.js'), V = require('./investimenti.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }

// --- 1. matematica finanziaria su casi noti ---------------------------------------------------
// −1.000, poi 500 per tre anni al 10%: VAN = 500 × 2,486852 − 1.000 = 243,43
vicino('VAN', V.van([-1000, 500, 500, 500], 0.10), 243.43); vicino('VAN a tasso zero', V.van([-1000, 500, 500, 500], 0), 500);
vicino('TIR di −1.000 +1.100', V.tir([-1000, 1100]), 0.10, 1e-8); vicino('TIR di −1.000 e tre da 500 (23,375%)', V.tir([-1000, 500, 500, 500]), 0.233752, 1e-5);
vero('TIR non definito con soli flussi positivi', V.tir([100, 100]) === null); vero('TIR non definito con più cambi di segno', V.tir([-100, 300, -250]) === null);
vicino('recupero semplice: 2 anni', V.recupero([-1000, 500, 500, 500], 0), 2); vicino('recupero con interpolazione: 2,5 anni', V.recupero([-1000, 400, 400, 400], 0), 2.5);
vero('recupero mai raggiunto', V.recupero([-1000, 100, 100], 0) === null);
// rata costante: 10.000 al 5% in 3 anni → 3.672,09; interessi totali 1.016,26
const p = V.piano(10000, 0.05, 3);
vicino('rata', p.rata, 3672.09); vicino('interessi totali', p.interessi, 1016.26, 0.02); vicino('interessi del primo anno', p.righe[0].interessi, 500); vicino('debito residuo finale', p.righe[2].residuo, 0);
vicino('rata a tasso zero', V.piano(9000, 0, 3).rata, 3000);

// --- 2. investimento calcolato a mano, senza imposte -----------------------------------------
// 100.000 + 10.000 di installazione, vita 5 anni, risparmio 30.000, costi 4.000 → beneficio 26.000; sconto 8%
const inv = { nome: 'Pressa', importo: 100000, accessori: 10000, vitaUtile: 5, valoreResiduo: 0, risparmioAnnuo: 30000, costiAnnui: 4000 };
let k = V.calcola(inv, { tassoSconto: 0.08, aliquota: 0 }, {});
vicino('uscita', k.uscita, 110000); vicino('ammortamento', k.ammortamento, 22000); vicino('beneficio annuo', k.beneficioBase, 26000);
vicino('VAN = 26.000 × 3,99271 − 110.000', k.van, 26000 * 3.992710037 - 110000, 0.05); vero('VAN negativo → non conviene', k.van < 0 && k.esito === 'no' && k.rischio === 'alto');
vicino('recupero 110.000 / 26.000', k.recupero, 110000 / 26000, 1e-9); vero('recupero attualizzato non raggiunto', k.recuperoAttualizzato === null);
vicino('TIR', V.van(k.flussi, k.tir), 0, 0.001); vero('TIR sotto il tasso di sconto', k.tir < 0.08);
// con contributo di 20.000: uscita 90.000 → VAN positivo
k = V.calcola(Object.assign({}, inv, { contributo: 20000 }), { tassoSconto: 0.08, aliquota: 0 }, {});
vicino('con contributo: VAN', k.van, 26000 * 3.992710037 - 90000, 0.05); vero('contributo segnalato come ipotesi', k.ipotesi.some(x => /contributo/i.test(x)));
vicino('soglia dei benefici: 90.000 / (30.000 × 3,99271) + quota costi', k.sogliaBenefici, (90000 / 3.992710037 + 4000) / 30000, 1e-6);
// con imposte al 30%: flusso = 26.000 − (26.000 − 22.000) × 30% = 24.800
k = V.calcola(inv, { tassoSconto: 0.08, aliquota: 0.30 }, {});
vicino('con imposte: flusso annuo', k.righe[0].flusso, 24800); vicino('redditività media: (26.000 − 22.000) × 70% / 110.000', k.redditivitaMedia, 2800 / 110000, 1e-9);
// valore residuo e crescita dei benefici
k = V.calcola(Object.assign({}, inv, { valoreResiduo: 10000, crescita: 0.02 }), { tassoSconto: 0.08, aliquota: 0 }, {});
vicino('ammortamento con valore residuo', k.ammortamento, 20000); vicino('beneficio del terzo anno con crescita 2%', k.righe[2].beneficio, 26000 * 1.0404); vicino('ultimo anno comprende il valore residuo', k.righe[4].flusso, 26000 * Math.pow(1.02, 4) + 10000);
// finanziamento: 60% di 110.000 = 66.000 al 5% in 5 anni
k = V.calcola(Object.assign({}, inv, { finanziamentoQuota: 0.6, finanziamentoTasso: 0.05, finanziamentoAnni: 5 }), { tassoSconto: 0.08, aliquota: 0 }, {});
vicino('importo finanziato', k.finanziato, 66000); vicino('rata', k.piano.rata, 66000 * 0.05 / (1 - Math.pow(1.05, -5)), 0.01); vicino('da pagare in contanti', k.contanti, 44000);
vicino('flusso dopo la rata', k.righe[0].dopoDebito, 26000 - k.piano.rata, 0.01); vicino('copertura della rata', k.coperturaMinima, 26000 / k.piano.rata, 1e-6); vicino('fabbisogno massimo dei soci', k.fabbisogno, 44000);
vero('il VAN dell\'investimento non dipende da come è finanziato', Math.abs(k.van - (26000 * 3.992710037 - 110000)) < 0.05);
// maggiori ricavi: senza margine e senza bilancio → errore; con margine del bilancio → ipotesi dichiarata
k = V.calcola({ importo: 50000, vitaUtile: 5, ricaviAnnui: 40000 }, V.PARAMETRI, {});
vero('ricavi senza margine: non calcolato', !k.valido && k.errori.length === 1);
k = V.calcola({ importo: 50000, vitaUtile: 5, ricaviAnnui: 40000 }, { tassoSconto: 0.08, aliquota: 0 }, { mcPct: 0.4 });
vicino('ricavi con margine del bilancio', k.beneficioBase, 16000); vero('margine del bilancio dichiarato tra le ipotesi', k.ipotesi.some(x => /margine di contribuzione attuale/.test(x)));
vero('importo o vita utile mancanti: errore', !V.calcola({ vitaUtile: 5 }, V.PARAMETRI, {}).valido && !V.calcola({ importo: 100 }, V.PARAMETRI, {}).valido);
// investimento conveniente e solido; effetto sui conti dell'azienda
const buono = { importo: 100000, vitaUtile: 8, risparmioAnnuo: 40000 };
const n = { ricavi: 1000000, var_rim_prodotti: 0, altri_ricavi: 0, materie: 500000, var_rim_materie: 0, servizi: 150000, godimento: 0, personale: 200000, ammortamenti: 50000, svalutazioni_acc: 0, oneri_diversi: 0, proventi_fin: 0, oneri_fin: 10000, rettifiche_fin: 0, imposte: 20000,
  imm_immateriali: 0, imm_materiali: 400000, imm_finanziarie: 0, rimanenze: 100000, crediti_clienti: 200000, altri_crediti: 0, attivita_fin_breve: 0, liquidita: 30000, ratei_attivi: 0, capitale_riserve: 260000, fondi_rischi: 0, tfr: 50000, debiti_banche_breve: 100000, debiti_banche_lungo: 100000, altri_debiti_fin: 0, debiti_fornitori: 130000, debiti_tributari: 20000, altri_debiti: 0, ratei_passivi: 0 };
const az = { esercizi: { 2025: { valori: n } }, classificazione: {}, investimenti: { parametri: { tassoSconto: 0.08, aliquota: 0 }, elenco: [buono, inv] } };
const ctx = V.contesto(az, 2025, n, true, true);
k = V.calcola(buono, { tassoSconto: 0.08, aliquota: 0 }, ctx);
vero('investimento solido: conviene con riserva per la cassa', k.van > 0 && k.rischio === 'basso' && k.esito === 'riserva' && k.azienda.cassaInsufficiente, k.esito + ' ' + k.riserve.join());
vicino('EBITDA dopo', k.azienda.ebitdaDopo, 150000 + 40000); vicino('debito netto dopo', k.azienda.pfnDopo, 170000 + 100000); vicino('PFN/EBITDA: da 1,13 a 1,42', k.azienda.rapportoDopo, 270000 / 190000, 1e-9);
k = V.calcola(Object.assign({}, buono, { finanziamentoQuota: 0.8, finanziamentoTasso: 0.05, finanziamentoAnni: 5 }), { tassoSconto: 0.08, aliquota: 0 }, ctx);
vero('con finanziamento all\'80% la cassa basta: conviene', k.esito === 'si' && k.contanti === 20000, k.esito + ' ' + k.riserve.join());
const an = V.analisi(az, ctx);
vero('classifica per VAN su euro investito', an.classifica[0].inv === buono && an.classifica[0].k.posizione === 1 && an.classifica.length === 2);
vero('senza bilancio completo: nessun effetto sui conti inventato', V.calcola(buono, V.PARAMETRI, V.contesto(az, 2025, n, true, false)).azienda === undefined);

// --- 3. investimenti simulati ------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [1, 22, 303]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.investimenti = V.simula(zz); aziende++;
  const e = V.collaudo(zz); tot += e.length; sup += e.filter(x => x.ok).length;
  e.filter(x => !x.ok).forEach(x => { (falliti[x.nome] = falliti[x.nome] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
}
vero('collaudo investimenti simulati ' + sup + '/' + tot, Object.keys(falliti).length === 0);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest investimenti superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con investimenti simulati: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
