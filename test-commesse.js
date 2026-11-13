/* Test del modulo Commesse.  Avvio:  node test-commesse.js */
const M = require('./motore.js'), S = require('./simulatore.js'), C = require('./commesse.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }

// --- 1. caso calcolato a mano ---------------------------------------------------------------
const risorse = [{ id: 'op', tipo: 'persona', costoOrario: 20 }, { id: 'pr', tipo: 'macchina', costoOrario: 10, potenzaKw: 50, fattoreCarico: 0.5 }];
const par = { prezzoKwh: 0.2 };
const c1 = { anno: 2024, codice: 'A', cliente: 'Uno', prodotto: 'X', ricavo: 10000, materiali: 3000, esterni: 500, trasporti: 100, qProdotta: 1100, qScartata: 100, preventivo: { costo: 6000 },
  ore: [{ risorsa: 'op', ore: 100 }, { risorsa: 'pr', ore: 40 }] };
const k1 = C.calcola(c1, risorse, par);
vicino('lavoro', k1.lavoro, 2000); vicino('macchine', k1.macchine, 400);
vicino('kWh stimati 40h × 50kW × 0,5', k1.kwh, 1000); vicino('energia', k1.energia, 200); vero('energia stimata', k1.energiaOrigine === 'stimata');
vicino('costo diretto', k1.costoDiretto, 6200); vicino('margine lordo', k1.margineLordo, 3800); vicino('margine %', k1.margineLordoPct, 0.38);
vicino('costo unitario', k1.costoUnitario, 6.2); vicino('scarto %', k1.scartoPct, 100 / 1100, 1e-6); vicino('scostamento', k1.scostamento, 200);
const k1m = C.calcola(Object.assign({}, c1, { ore: [{ risorsa: 'op', ore: 100 }, { risorsa: 'pr', ore: 40, kwh: 800 }] }), risorse, par);
vicino('kWh misurati prevalgono sulla stima', k1m.kwh, 800); vero('energia misurata', k1m.energiaOrigine === 'misurata');
vero('risorsa inesistente segnalata', C.calcola({ ricavo: 1, ore: [{ risorsa: 'zz', ore: 5 }] }, risorse, par).risorseMancanti === 1);

// bilancio: ricavi 30.000, materie 12.000, servizi 5.000, personale 8.000, ammortamenti 2.000 → costi operativi 27.000, EBIT 3.000
const n = { ricavi: 30000, var_rim_prodotti: 0, altri_ricavi: 0, materie: 12000, var_rim_materie: 0, servizi: 5000, godimento: 0, personale: 8000, ammortamenti: 2000, svalutazioni_acc: 0, oneri_diversi: 0, proventi_fin: 0, oneri_fin: 0, rettifiche_fin: 0, imposte: 0 };
const c2 = { anno: 2024, codice: 'B', cliente: 'Due', prodotto: 'Y', ricavo: 20000, materiali: 8000, esterni: 0, trasporti: 0, ore: [{ risorsa: 'op', ore: 190 }] }; // costo diretto 11.800
const az = { esercizi: { 2024: { valori: n } }, classificazione: {}, commesse: { risorse, parametri: par, elenco: [c1, c2] } };
const a = C.analisi(az, 2024, n, true);
vicino('costi diretti totali', a.totali.costoDiretto, 18000);
vicino('costi indiretti = 27.000 − 18.000', a.indiretti, 9000);
vicino('quota indiretti commessa A (6.200/18.000)', a.righe[0].k.quotaIndiretti, 3100);
vicino('margine operativo A', a.righe[0].k.margineOperativo, 700);
vicino('margine operativo B', a.righe[1].k.margineOperativo, 20000 - 11800 - 5900);
vicino('quadratura con EBIT', a.quadraturaEbit, 0);
vero('riconciliazione senza errori', a.errori === 0);
vicino('saturazione lavoro 5.800/8.000', a.saturazioneLavoro, 0.725);
vero('cliente principale', a.clienti[0].nome === 'Due' && Math.abs(a.clienti[0].quota - 2 / 3) < 1e-9);
vero('concentrazione rilevata', a.criticita.some(x => x.id === 'concentrazione_clienti' && x.gravita === 'rosso'));
// base di ribaltamento diversa: stessi indiretti totali
az.commesse.parametri = { prezzoKwh: 0.2, base: 'ricavi' };
const aR = C.analisi(az, 2024, n, true);
vicino('base ricavi: quota A = 9.000 × 1/3', aR.righe[0].k.quotaIndiretti, 3000); vicino('base ricavi: quadratura', aR.quadraturaEbit, 0);
// doppio conteggio: materiali attribuiti oltre il bilancio → errore
az.commesse.elenco = [c1, Object.assign({}, c2, { materiali: 12000 })];
const aE = C.analisi(az, 2024, n, true);
vero('materiali oltre il bilancio: errore di riconciliazione', aE.errori === 1 && aE.criticita[0].id === 'riconciliazione');
// senza bilancio completo: solo margine lordo, niente ribaltamento inventato
const aS = C.analisi(az, 2024, { ricavi: 30000 }, false);
vero('senza conto economico completo: nessun costo indiretto', aS.indiretti === null && aS.righe[0].k.margineOperativo === undefined);

// --- 2. commesse simulate su tutte le combinazioni ------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = [];
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [11, 222, 3333]) {
  const z = S.genera({ settore, profilo, seme, anni: 3 }); z.commesse = C.simula(z, seme); aziende++;
  const e = C.collaudo(z); tot += e.length; sup += e.filter(x => x.ok).length;
  e.filter(x => !x.ok).forEach(x => falliti.push(settore + '/' + profilo + '/' + seme + ' · ' + x.nome + ' — ' + x.dettaglio));
}
vero('collaudo commesse simulate ' + sup + '/' + tot, falliti.length === 0);
const gr = {}; falliti.forEach(f => { const k = f.split(' · ').slice(1).join(' · ').replace(/^\d+ · /, '').split(' — ')[0]; (gr[k] = gr[k] || []).push(f); });
Object.keys(gr).forEach(k => console.log(gr[k].length, k, '\n   ', gr[k].slice(0, 2).join('\n    ')));
console.log('\nTest commesse superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con commesse simulate: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
