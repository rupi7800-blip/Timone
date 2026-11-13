/* Test del modulo Personale.  Avvio:  node test-personale.js */
const M = require('./motore.js'), S = require('./simulatore.js'), P = require('./personale.js'), I = require('./importa.js'), C = require('./commesse.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }
const par = P.PARAMETRI;

// --- 1. caso calcolato a mano ---------------------------------------------------------------
// RAL 27.000, contributi 8.100, TFR 2.000, INAIL 300, formazione 600 → B9 37.400, costo pieno 38.000; 1.900 ore → 20 €/h
let k = P.persona({ ral: 27000, contributi: 8100, tfr: 2000, inail: 300, formazione: 600, oreContratto: 2080, oreLavorate: 1900, oreStraordinario: 95, oreAssenza: 275 }, par);
vicino('costo di bilancio', k.costoBilancio, 37400); vicino('costo pieno', k.costo, 38000); vicino('costo orario', k.costoOra, 20);
vicino('quota straordinari', k.quotaStraordinari, 0.05); vicino('quota assenze', k.quotaAssenze, 275 / 2080, 1e-9); vero('nessun valore calcolato', k.calcolati.length === 0);
// senza contributi e TFR: calcolati ed etichettati (27.000 × 30% = 8.100; 27.000 ÷ 13,5 = 2.000)
k = P.persona({ ral: 27000 }, par);
vicino('contributi calcolati', k.contributi, 8100); vicino('TFR calcolato', k.tfr, 2000); vero('etichettati come calcolati', k.calcolati.join() === 'contributi,TFR');
vero('ore mancanti: costo orario non stimato', k.costoOra === null && k.mancanti.indexOf('ore lavorate') >= 0);

const persone = [
  { codice: 'D1', reparto: 'Produzione', tipo: 'diretto', ral: 27000, contributi: 8100, tfr: 2000, inail: 300, formazione: 600, oreContratto: 2080, oreLavorate: 1900, oreStraordinario: 300, oreAssenza: 200 },
  { codice: 'D2', reparto: 'Produzione', tipo: 'diretto', ral: 27000, contributi: 8100, tfr: 2000, inail: 300, formazione: 600, oreContratto: 2080, oreLavorate: 1900, oreStraordinario: 300, oreAssenza: 200 },
  { codice: 'I1', reparto: 'Uffici', tipo: 'indiretto', ral: 30000, contributi: 9000, tfr: 2200, inail: 0, oreContratto: 2080, oreLavorate: 1800, oreStraordinario: 0, oreAssenza: 280 }];
const n = { ricavi: 500000, var_rim_prodotti: 0, altri_ricavi: 0, materie: 200000, var_rim_materie: 0, servizi: 80000, godimento: 10000, personale: 116000, ammortamenti: 20000, svalutazioni_acc: 0, oneri_diversi: 4000, proventi_fin: 0, oneri_fin: 0, rettifiche_fin: 0, imposte: 0 };
const az = { esercizi: { 2024: { valori: n } }, classificazione: { materie: { quota: 1 }, servizi: { quota: 0.5 } }, personale: { parametri: {}, anni: { 2024: { persone } } } };
let a = P.analisi(az, 2024, n, true);
vicino('totale di bilancio', a.totali.costoBilancio, 37400 * 2 + 41200); vero('riconciliato', a.riconciliato && a.differenza === 0);
vicino('fuori dalla voce B9', a.fuoriB9, 1200); vicino('costo orario diretti', a.tipi.diretto.costoOra, 20);
vicino('quota indiretti', a.quotaIndiretti, 41200 / 117200, 1e-9); vicino('ricavi per persona', a.ricaviFte, 500000 / 3);
vicino('valore aggiunto per persona', a.vaFte, (500000 - 294000) / 3); vicino('valore aggiunto per ora', a.vaOra, 206000 / 5600, 1e-6);
vero('straordinari rilevati in Produzione (15,8%)', a.criticita.some(x => x.id === 'straordinari' && /Produzione/.test(x.dati)));
vero('assenze sotto soglia: nessun allarme', !a.criticita.some(x => x.id === 'assenze'));
// assunzione: 1 persona a 30.000 → 30.000 × 1,30 + 2.222,22 = 41.222,22; MC% = (500.000 − 240.000) / 500.000 = 52%
let s = P.simulaAssunzione(a, { numero: 1, ral: 30000 });
vicino('assunzione: costo', s.costo, 41222.22); vicino('assunzione: EBITDA dopo', s.ebitdaDopo, 90000 - 41222.22); vicino('assunzione: produzione necessaria', s.produzioneNecessaria, 41222.22 / 0.52);
// straordinari: 20 €/h × 1,25 = 25 €/h; costo medio diretto 38.000; soglia = 1.520 ore; per 1.000 ore convengono gli straordinari
s = P.simulaStraordinari(a, { ore: 1000 });
vicino('straordinari: costo', s.costoStraordinari, 25000); vicino('straordinari: soglia', s.soglia, 1520); vero('straordinari convenienti a 1.000 ore', s.conviene === 'straordinari' && s.persone === 1);
vero('assunzione conveniente a 1.800 ore', P.simulaStraordinari(a, { ore: 1800 }).conviene === 'assunzione');
// esternalizzazione: 1.000 ore a 18 €/h, costo interno evitabile al 60% → risparmio 12.000 contro 18.000 → non conviene
s = P.simulaEsternalizzazione(a, { ore: 1000, tariffa: 18, quotaEvitabile: 0.6 });
vicino('esternalizzazione: effetto', s.effetto, -6000); vicino('esternalizzazione: tariffa di pareggio', s.tariffaPareggio, 12);
// differenza con il bilancio e confronto con i costi orari delle commesse
a = P.analisi(az, 2024, Object.assign({}, n, { personale: 150000 }), true);
vero('differenza con il bilancio segnalata', !a.riconciliato && a.criticita[0].id === 'personale_bilancio');
az.commesse = { risorse: [{ id: 'op', tipo: 'persona', costoOrario: 15 }], elenco: [] };
a = P.analisi(az, 2024, n, true);
vero('costo orario delle commesse non allineato (15 contro 20)', a.criticita.some(x => x.id === 'costo_orario_commesse') && Math.abs(a.scartoCommesse + 0.25) < 1e-9);
vero('senza conto economico: nessuna produttività inventata', P.analisi(az, 2024, { personale: 116000 }, false).ricaviFte === undefined);

// --- 2. importazione ---------------------------------------------------------------------------
const imp = P.daTabella(I.csv('Matricola;Reparto;Tipo;FTE;RAL;Contributi;Ore lavorate;Straordinari\nA1;Produzione;diretto;100;28.000,50;8.400;1.810;90\nA2;Uffici;Indiretto;50;15.000;;900;\nA3;Uffici;indiretto;1;;;;\n'), I.numero);
vero('import: due persone', imp.persone.length === 2, imp.persone.length);
vero('import: numeri italiani e FTE in percentuale', imp.persone[0].ral === 28000.5 && imp.persone[0].fte === 1 && imp.persone[1].fte === 0.5);
vero('import: tipo e contributi mancanti', imp.persone[1].tipo === 'indiretto' && imp.persone[1].contributi === undefined);
vero('import: riga senza retribuzione segnalata', imp.avvisi.some(x => /senza retribuzione/.test(x)));
vero('import: modello rileggibile', P.daTabella(I.csv(P.modelloCsv()), I.numero).persone.length === 1);
vero('import: intestazione mancante', P.daTabella(I.csv('a;b\n1;2\n'), I.numero).persone.length === 0);

// --- 3. personale simulato ---------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [4, 55, 606]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.commesse = C.simula(zz, seme); zz.personale = P.simula(zz, seme);
  if (!Object.keys(zz.personale.anni).length) continue; aziende++;
  const e = P.collaudo(zz); tot += e.length; sup += e.filter(x => x.ok).length;
  e.filter(x => !x.ok).forEach(x => { const kk = x.nome.replace(/^\d+ · /, ''); (falliti[kk] = falliti[kk] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
}
vero('collaudo personale simulato ' + sup + '/' + tot, Object.keys(falliti).length === 0);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest personale superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con personale simulato: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
