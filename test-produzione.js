/* Test del modulo Produzione.  Avvio:  node test-produzione.js */
const M = require('./motore.js'), S = require('./simulatore.js'), P = require('./produzione.js'), I = require('./importa.js'), C = require('./commesse.js'), E = require('./energia.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }

// --- 1. caso calcolato a mano ---------------------------------------------------------------
// 400 ore disponibili, 20 di manutenzione → 380 pianificate; 40 di fermo e 20 di attrezzaggio → 320 operative
// tempo ciclo 36 s → 100 pezzi/ora standard → 32.000 teorici; prodotti 28.800 (90%), scartati 1.440 (5%)
const r1 = { macchina: 'a', anno: 2025, mese: 1, oreDisponibili: 400, oreManutenzione: 20, oreFermo: 40, oreAttrezzaggio: 20, pezziProdotti: 28800, pezziScartati: 1440, tempoCiclo: 36, kwh: 9600, valorePezzo: 0.5 };
let a = P.aggrega([r1]);
vicino('ore pianificate', a.pianificate, 380); vicino('ore operative', a.operative, 320); vicino('disponibilità 320/380', a.disponibilita, 320 / 380, 1e-9);
vicino('performance 90%', a.performance, 0.9, 1e-9); vicino('qualità 95%', a.qualita, 0.95, 1e-9); vicino('OEE', a.oee, 320 / 380 * 0.9 * 0.95, 1e-9);
vicino('pezzi buoni per ora', a.pezziOra, 27360 / 320); vicino('tempo ciclo effettivo 40 s', a.cicloEffettivo, 40); vicino('kWh per pezzo buono', a.kwhPezzo, 9600 / 27360, 1e-9);
vicino('perdita di disponibilità 60 ore', a.perdite.disponibilita, 60); vicino('perdita di performance 32 ore', a.perdite.performance, 32); vicino('perdita di qualità 14,4 ore', a.perdite.qualita, 14.4);
vero('perdita principale: disponibilità', a.perditaPrincipale === 'disponibilita'); vicino('costo dei pezzi scartati', a.valoreScarti, 720);
// due mesi: le percentuali si calcolano sui totali, non come media delle percentuali
a = P.aggrega([r1, Object.assign({}, r1, { mese: 2, oreFermo: 0, oreAttrezzaggio: 0, pezziProdotti: 34200, pezziScartati: 0 })]);
vicino('due mesi: disponibilità (320+380)/760', a.disponibilita, 700 / 760, 1e-9); vicino('due mesi: performance 63.000/70.000', a.performance, 0.9, 1e-9);
// senza tempo ciclo: niente performance né OEE; registrazione incoerente segnalata
a = P.aggrega([Object.assign({}, r1, { tempoCiclo: undefined })]);
vero('senza tempo ciclo: OEE non calcolato', a.performance === null && a.oee === null && a.disponibilita !== null && a.qualita !== null && a.senzaCiclo === 1);
vero('fermi oltre le ore disponibili: incoerente', P.aggrega([{ oreDisponibili: 100, oreFermo: 120, pezziProdotti: 10, pezziScartati: 0 }]).incoerenti === 1);
vero('scarti oltre i pezzi: incoerente', P.aggrega([{ oreDisponibili: 100, pezziProdotti: 10, pezziScartati: 20 }]).incoerenti === 1);

// analisi con bilancio e commesse: margine di contribuzione 160.000 su 320 ore operative → 500 €/ora
const n = { ricavi: 500000, var_rim_prodotti: 0, altri_ricavi: 0, materie: 300000, var_rim_materie: 0, servizi: 80000, godimento: 0, personale: 60000, ammortamenti: 20000, svalutazioni_acc: 0, oneri_diversi: 0, proventi_fin: 0, oneri_fin: 0, rettifiche_fin: 0, imposte: 0 };
const az = { esercizi: {}, classificazione: { materie: { quota: 1 }, servizi: { quota: 0.5 } },
  commesse: { risorse: [{ id: 'rm', tipo: 'macchina', nome: 'Pressa' }], elenco: [{ anno: 2025, ore: [{ risorsa: 'rm', ore: 300 }] }] },
  energia: { utenze: [{ id: 'u', vettore: 'elettricita', uso: 'produzione' }], bollette: [{ utenza: 'u', anno: 2025, mese: 1, consumo: 12000, totale: 2400 }] },
  produzione: { parametri: {}, macchine: [{ id: 'a', nome: 'Pressa', risorsaCommesse: 'rm', capacitaOreMese: 352 }], registrazioni: [r1] } };
let an = P.analisi(az, 2025, n, true);
vicino('valore di un\'ora (margine di contribuzione ÷ ore operative)', an.margineOra, 160000 / 320); vicino('costo dei fermi stimato', an.macchine[0].costoFermo, 40 * 500); vero('costo dei fermi etichettato come stimato', an.macchine[0].costoFermoOrigine === 'stimato' && an.costoFermiStimato);
vicino('saturazione 320/352', an.macchine[0].saturazione, 320 / 352, 1e-9); vicino('ore attribuite alle commesse', an.macchine[0].oreCommesse, 300); vero('commesse entro le ore operative', !an.macchine[0].commesseOltre);
vicino('kWh macchine su bollette', an.energia.quota, 0.8, 1e-9); vero('nessun errore di coerenza', !an.criticita.some(x => x.gravita === 'rosso'), an.criticita.map(x => x.id).join());
vero('OEE 72% sopra l\'obiettivo: nessun allarme OEE, ma fermi oltre il 10%', !an.criticita.some(x => x.id === 'oee_basso') && an.criticita.some(x => x.id === 'fermi_elevati'));
az.produzione.macchine[0].costoFermoOra = 200;
an = P.analisi(az, 2025, n, true);
vero('costo orario di fermo inserito prevale sulla stima', an.macchine[0].costoFermo === 8000 && an.macchine[0].costoFermoOrigine === 'inserito');
delete az.produzione.macchine[0].costoFermoOra;
vero('senza bilancio e senza costo orario: costo dei fermi assente', P.analisi(az, 2025, null, false).macchine[0].costoFermo === null);
az.commesse.elenco[0].ore[0].ore = 400;
vero('ore delle commesse oltre le ore operative: errore', P.analisi(az, 2025, n, true).criticita[0].id === 'ore_commesse_oltre');
az.commesse.elenco[0].ore[0].ore = 300; az.energia.bollette[0].consumo = 5000;
vero('kWh oltre le bollette: errore', P.analisi(az, 2025, n, true).criticita.some(x => x.id === 'kwh_oltre_bollette'));
az.energia.bollette[0].consumo = 12000; az.produzione.registrazioni = [Object.assign({}, r1, { oreFermo: 150, pezziProdotti: 17000, pezziScartati: 850 })];
an = P.analisi(az, 2025, n, true);
vero('OEE basso con perdita principale indicata', an.criticita.some(x => x.id === 'oee_basso' && /fermi e attrezzaggi/.test(x.dati)), an.criticita.map(x => x.id).join());
az.produzione.registrazioni = [Object.assign({}, r1, { pezziProdotti: 36000, pezziScartati: 0 })];
vero('performance oltre il 100%: ciclo standard da verificare', P.analisi(az, 2025, n, true).criticita.some(x => x.id === 'ciclo_da_verificare'));

// --- 2. importazione ---------------------------------------------------------------------------
const imp = P.daTabella(I.csv('Macchina;Anno;Mese;Ore disponibili;Ore fermo;Attrezzaggio;Pezzi prodotti;Scarti;Tempo ciclo;kWh\nPressa 1;2025;gen;352;30,5;22;31.500;630;30;7.800\nPressa 2;2025;1;352;;;;;;\nPressa 1;2025;;10;;;;;;\n'), I.numero, []);
vero('import: due registrazioni e due macchine', imp.registrazioni.length === 2 && imp.macchine.length === 2, imp.registrazioni.length + '/' + imp.macchine.length);
vero('import: numeri italiani e mese in lettere', imp.registrazioni[0].oreFermo === 30.5 && imp.registrazioni[0].pezziProdotti === 31500 && imp.registrazioni[0].mese === 1);
vero('import: riga senza mese segnalata', imp.avvisi.some(x => /non sono state importate/.test(x)));
vero('import: macchina esistente riusata', P.daTabella(I.csv('Macchina;Anno;Mese;Ore disponibili\npressa 1;2025;2;100\n'), I.numero, [{ id: 'a', nome: 'Pressa 1' }]).registrazioni[0].macchina === 'a');
vero('import: modello rileggibile', P.daTabella(I.csv(P.modelloCsv()), I.numero, []).registrazioni.length === 1);
vero('import: intestazione mancante', P.daTabella(I.csv('a;b\n1;2\n'), I.numero, []).registrazioni.length === 0);

// --- 3. produzione simulata --------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0, senza = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [2, 33, 404]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.commesse = C.simula(zz, seme); zz.energia = E.simula(zz, seme); zz.produzione = P.simula(zz, seme);
  if (!zz.produzione.registrazioni.length) { senza++; continue; } aziende++;
  const e = P.collaudo(zz); tot += e.length; sup += e.filter(x => x.ok).length;
  e.filter(x => !x.ok).forEach(x => { const kk = x.nome.replace(/^\d+ · /, ''); (falliti[kk] = falliti[kk] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
}
vero('collaudo produzione simulata ' + sup + '/' + tot, Object.keys(falliti).length === 0);
vero('settori senza macchine: nessun dato di produzione inventato', senza === 54, senza);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest produzione superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con produzione simulata: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
