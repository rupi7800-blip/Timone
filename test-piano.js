/* Test del modulo Piano pluriennale.  Avvio:  node test-piano.js */
const M = require('./motore.js'), S = require('./simulatore.js'), P = require('./piano.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 1e-6)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }
const eur = x => '€ ' + Math.round(x);

// --- 1. bilancio di partenza costruito a mano --------------------------------------------------
// Ricavi 1.000; materie 400 (tutte variabili); servizi 100 e personale 200 (fissi); ammortamenti 50; interessi 20 su 400 di debito (5%);
// risultato ante imposte 230, imposte 69 (30%), utile 161. Attivo 900: impianti 500, scorte 100, crediti 200, cassa 100.
// Passivo: capitale e riserve 239 + utile 161, banche a lungo 400, fornitori 100.
const n0 = {}; M.VOCI.forEach(v => { if (v.tipo !== 'ges') n0[v.id] = 0; });
Object.assign(n0, { ricavi: 1000, materie: 400, servizi: 100, personale: 200, ammortamenti: 50, oneri_fin: 20, imposte: 69, imm_materiali: 500, rimanenze: 100, crediti_clienti: 200, liquidita: 100, capitale_riserve: 239, debiti_banche_lungo: 400, debiti_fornitori: 100 });
const cl = {}; M.COSTI_OPERATIVI.forEach(k => { cl[k] = { quota: (k === 'materie' || k === 'var_rim_materie') ? 1 : 0, confermata: true }; });
vero('il bilancio di partenza quadra', Math.abs(M.riclassifica(n0, cl).quadratura) < 1e-9 && M.mancanti(n0).length === 0);
// volumi +10% l'anno, rimborso del debito in 4 anni
let x = P.proietta(n0, cl, 2, { volumi: 0.1, anniRimborso: 4 }), a = x.anni[0];
vicino('aliquota effettiva dell\'anno di partenza', x.aliquota, 0.3); vicino('tasso medio del debito', x.tasso, 0.05); vero('nessuna ipotesi sostitutiva', !x.aliquotaStimata && !x.tassoStimato);
vicino('anno 1: ricavi', a.r.ricavi, 1100); vicino('anno 1: consumi di materie', a.r.consumi_materie, 440); vicino('anno 1: scorte (stessi giorni)', a.n.rimanenze, 110); vicino('anno 1: acquisti = consumi + aumento scorte', a.n.materie, 450);
vicino('anno 1: EBITDA', a.r.ebitda, 360); vicino('anno 1: interessi sul debito iniziale', a.n.oneri_fin, 20); vicino('anno 1: imposte 30% di 290', a.n.imposte, 87); vicino('anno 1: utile', a.r.utile, 203);
vicino('anno 1: crediti (stessi giorni di incasso)', a.n.crediti_clienti, 220); vicino('anno 1: fornitori (stessi giorni di pagamento)', a.n.debiti_fornitori, 110); vicino('anno 1: impianti', a.n.imm_materiali, 450); vicino('anno 1: debito a lungo', a.n.debiti_banche_lungo, 300);
vicino('anno 1: capitale e riserve = 239 + utile precedente', a.n.capitale_riserve, 400); vicino('anno 1: patrimonio netto', a.r.patrimonio_netto, 603);
vicino('anno 1: liquidità = 100 + 203 + 50 − 20 di circolante − 100 di rimborso', a.n.liquidita, 233); vicino('anno 1: quadratura', a.r.quadratura, 0); vicino('anno 1: rendiconto senza differenze', a.flussi.differenza, 0); vicino('anno 1: flusso operativo', a.flussi.flusso_operativo, 233);
vicino('anno 1: copertura 360 ÷ (100 + 20)', a.copertura, 3); vicino('anno 1: PFN / EBITDA', a.pfnEbitda, (300 - 233) / 360);
a = x.anni[1]; vicino('anno 2: ricavi', a.r.ricavi, 1210); vicino('anno 2: EBITDA', a.r.ebitda, 426); vicino('anno 2: interessi 5% di 300', a.n.oneri_fin, 15); vicino('anno 2: utile', a.r.utile, 361 * 0.7); vicino('anno 2: quadratura', a.r.quadratura, 0);
vicino('crescita media dei ricavi', x.sintesi.crescitaMedia, 0.1); vicino('utile cumulato', x.sintesi.utileCumulato, 203 + 252.7); vero('nessun segnale di rischio', Object.keys(x.segnali).every(k => x.segnali[k] === null) && x.sintesi.fabbisogno === 0);
// prezzi e costi: prezzi +5%, personale +10%
a = P.proietta(n0, cl, 1, { prezzi: 0.05, inflPersonale: 0.1, anniRimborso: 4 }).anni[0]; vicino('prezzi +5%: ricavi', a.r.ricavi, 1050); vicino('personale +10%', a.n.personale, 220); vicino('consumi invariati con volumi fermi', a.r.consumi_materie, 400); vicino('EBITDA', a.r.ebitda, 1050 - 500 - 220);
// investimento di 80 in 4 anni, finanziato con 60 in 3 anni al 10%
x = P.proietta(n0, cl, 3, { anniRimborso: 4, investimenti: [{ anno: 1, importo: 80, vita: 4 }], finanziamenti: [{ anno: 1, importo: 60, durata: 3, tasso: 0.1 }] }); a = x.anni[0];
vicino('investimento: ammortamenti 50 + 20', a.ammortamenti, 70); vicino('investimento: impianti 500 − 70 + 80', a.n.imm_materiali, 510); vicino('finanziamento: debito a lungo 300 + 60', a.n.debiti_banche_lungo, 360); vicino('finanziamento: nessun interesse nell\'anno di erogazione', a.n.oneri_fin, 20); vero('erogato e investito registrati', a.erogati === 60 && a.investimenti === 80);
a = x.anni[1]; vicino('anno 2: interessi 5% di 300 + 10% di 60', a.n.oneri_fin, 21); vicino('anno 2: rimborsi 100 + 20', a.rimborsi, 120); vicino('anno 2: debito a lungo', a.n.debiti_banche_lungo, 240); vicino('anno 2: servizio del debito', a.servizio, 141); vicino('sintesi: investimenti', x.sintesi.investimenti, 80);
vero('anni 1-3: quadrature e rendiconti a zero', x.anni.every(y => Math.abs(y.r.quadratura) < 1e-9 && Math.abs(y.flussi.differenza) < 1e-9));
// beni esistenti completamente ammortizzati: 500 ÷ 50 = 10 anni; rimborsi dal modulo Finanziamenti
x = P.proietta(Object.assign({}, n0, { imm_materiali: 120, liquidita: 480 }), cl, 4, {}, { rimborsi: [50, 0, 400, 0] }); vero('ammortamenti che si esauriscono (120 = 50 + 50 + 20) e avviso', x.anni[2].ammortamenti === 20 && x.anni[3].ammortamenti === 0 && x.anni[3].n.imm_materiali === 0 && x.avvisi.some(m => /ammortizzati/.test(m)));
vero('rimborsi indicati anno per anno, mai oltre il debito', x.anni[0].rimborsi === 50 && x.anni[1].rimborsi === 0 && x.anni[2].rimborsi === 350 && x.anni[3].n.debiti_banche_lungo === 0);
// liquidità minima 500: il piano ricorre al debito a breve
x = P.proietta(n0, cl, 2, { volumi: 0.1, anniRimborso: 4, liquiditaMinima: 500 }); a = x.anni[0];
vicino('liquidità minima: debito a breve 500 − 233', a.n.debiti_banche_breve, 267); vicino('liquidità al minimo', a.n.liquidita, 500); vicino('nuova finanza a breve', a.nuovoBreve, 267); vicino('anno 2: interessi anche sul breve', x.anni[1].n.oneri_fin, 0.05 * (300 + 267)); vero('segnale e fabbisogno', x.segnali.nuovaFinanza === 1 && Math.abs(x.sintesi.fabbisogno - x.sintesi.breveMax) < 1e-9 && x.sintesi.breveMax >= 267);
x = P.proietta(Object.assign({}, n0, { debiti_banche_breve: 60, capitale_riserve: 179 }), cl, 1, { volumi: 0.1, anniRimborso: 4 }); vicino('cassa in eccesso: il breve esistente viene rimborsato', x.anni[0].n.debiti_banche_breve, 0); vicino('…e la liquidità ne tiene conto', x.anni[0].n.liquidita, 173);   // il tasso medio è 20 ÷ 460: gli interessi dell'anno restano 20
// dividendi, aumento di capitale, giorni di incasso
a = P.proietta(n0, cl, 1, { volumi: 0.1, anniRimborso: 4, dividendi: 0.5, aumenti: [{ anno: 1, importo: 40 }] }).anni[0]; vicino('dividendi: metà dell\'utile precedente', a.dividendi, 80.5); vicino('capitale e riserve', a.n.capitale_riserve, 239 + 161 - 80.5 + 40); vicino('liquidità', a.n.liquidita, 233 - 80.5 + 40);
a = P.proietta(n0, cl, 1, { anniRimborso: 4, giorniIncasso: 36.5, giorniScorta: 0, giorniPagamento: 0 }).anni[0]; vicino('giorni di incasso a 36,5: crediti 100', a.n.crediti_clienti, 100); vicino('scorte azzerate: acquisti 300', a.n.materie, 300); vicino('fornitori pagati subito', a.n.debiti_fornitori, 0); vicino('EBITDA invariato', a.r.ebitda, 300);
// perdita: nessuna imposta negativa, segnali
x = P.proietta(n0, cl, 5, { volumi: -0.3, anniRimborso: 4 }); vero('volumi in forte calo: perdita, imposte a zero, segnali', x.segnali.perdita !== null && x.anni.every(y => y.n.imposte >= 0) && x.anni[4].n.imposte === 0 && x.segnali.copertura !== null && x.segnali.nuovaFinanza !== null && x.anni.every(y => Math.abs(y.r.quadratura) < 1e-9 && y.n.liquidita >= -1e-9));
let c = P.criticita({ nome: 'Prova', base: 2025 }, x, eur); vero('criticità: rate non coperte e nuova finanza', c.some(k => /rate non coperte/.test(k.titolo)) && c.some(k => /nuova finanza/.test(k.titolo)));
x = P.proietta(n0, cl, 10, { volumi: -0.3, anniRimborso: 4 }); vero('patrimonio netto negativo segnalato', x.segnali.pnNegativo !== null && P.criticita({ nome: 'P', base: 2025 }, x, eur).some(k => /patrimonio netto negativo/.test(k.titolo) && k.gravita === 'rosso'));
// ipotesi sostitutive dichiarate
x = P.proietta(Object.assign({}, n0, { personale: 600, oneri_fin: 0 }), cl, 1, {});   // partenza in perdita e senza interessi vero('aliquota e tasso ipotizzati e dichiarati', x.aliquotaStimata && x.aliquota === M.ALIQUOTA_IPOTESI && x.tassoStimato && x.tasso === 0.05 && x.avvisi.length === 2);
// crescita necessaria, varianti, controlli
let g = P.crescitaPerUtile(n0, cl, 2, { anniRimborso: 4 }, null, 252.7); vicino('crescita necessaria per un utile di 252,7 al secondo anno: 10%', g, 0.1, 1e-7); vero('obiettivo irraggiungibile', P.crescitaPerUtile(n0, cl, 2, {}, null, 1e9) === null);
let vp = P.variante({ volumi: 0.03, prezzi: 0.02, inflMaterie: 0.02, investimenti: [{ anno: 1, importo: 5 }] }, 'prudenziale'), vf = P.variante({ volumi: 0.03 }, 'favorevole');
vero('varianti: ±3 punti di volumi, ±1 di prezzi e costi; investimenti conservati', Math.abs(vp.volumi) < 1e-12 && Math.abs(vp.prezzi - 0.01) < 1e-12 && Math.abs(vp.inflMaterie - 0.03) < 1e-12 && vp.investimenti[0].importo === 5 && Math.abs(vf.volumi - 0.06) < 1e-12 && Math.abs(vf.inflPersonale + 0.01) < 1e-12);
const inc = Object.assign({}, n0); delete inc.personale; vero('bilancio incompleto: il piano non parte', P.valida(inc, 5, {}).length === 1 && P.analizza({ esercizi: {}, classificazione: {} }, { base: 2025, anni: 5 }).valido === false);
vero('bilancio che non quadra: il piano non parte', P.valida(Object.assign({}, n0, { liquidita: 300 }), 5, {}).some(m => /non quadra/.test(m))); vero('orizzonte e variazioni fuori limite', P.valida(n0, 11, {}).length === 1 && P.valida(n0, 5, { volumi: 2 }).length === 1);

// --- 2. piani simulati -------------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [9, 58, 404]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.piano = P.simula(zz); aziende++;
  const es = P.collaudo(zz); tot += es.length; sup += es.filter(k => k.ok).length;
  es.filter(k => !k.ok).forEach(k => { (falliti[k.nome] = falliti[k.nome] || []).push(settore + '/' + profilo + '/' + seme + ' ' + k.dettaglio); });
}
vero('collaudo piani simulati ' + sup + '/' + tot, Object.keys(falliti).length === 0 && tot > 0);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest piano superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con piani simulati: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
