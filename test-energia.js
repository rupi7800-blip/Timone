/* Test del modulo Energia e utenze.  Avvio:  node test-energia.js */
const M = require('./motore.js'), S = require('./simulatore.js'), E = require('./energia.js'), I = require('./importa.js'), C = require('./commesse.js');
let ok = 0, ko = 0;
function vicino(nome, v, atteso, tol) { (v !== null && v !== undefined && Math.abs(v - atteso) <= (tol || 0.01)) ? ok++ : (ko++, console.log('FALLITO', nome, 'ottenuto', v, 'atteso', atteso)); }
function vero(nome, c, extra) { c ? ok++ : (ko++, console.log('FALLITO', nome, extra || '')); }

// --- 1. caso calcolato a mano ---------------------------------------------------------------
vero('bolletta coerente', E.bolletta({ materia: 600, trasporto: 200, oneri: 140, imposte: 60, totale: 1000 }).coerente);
vero('bolletta incoerente', !E.bolletta({ materia: 600, trasporto: 200, oneri: 140, imposte: 60, totale: 1200 }).coerente);
vero('bolletta senza dettaglio', E.bolletta({ totale: 500 }).dettaglio === false && E.bolletta({ totale: 500 }).coerente);
vicino('totale ricavato dalle componenti', E.bolletta({ materia: 600, trasporto: 200, oneri: 140, imposte: 60 }).totale, 1000);

// 12 mesi da 10.000 kWh e 2.000 € (materia 1.200), agosto 2025 a 16.000 kWh; 2024: 10.000 kWh a 1.600 € al mese
const bollette = [];
for (let m = 1; m <= 12; m++) {
  bollette.push({ utenza: 'u1', anno: 2024, mese: m, consumo: 10000, materia: 960, trasporto: 320, oneri: 224, imposte: 96, totale: 1600, potenzaMax: 40 });
  const k = m === 8 ? 1.6 : 1;
  bollette.push({ utenza: 'u1', anno: 2025, mese: m, consumo: 10000 * k, f1: 6000 * k, f2: 2000 * k, f3: 2000 * k, materia: 1200 * k, trasporto: 400 * k, oneri: 280 * k, imposte: 120 * k, totale: 2000 * k, potenzaMax: 40 });
}
const az = { esercizi: {}, classificazione: {}, energia: { parametri: {}, utenze: [{ id: 'u1', nome: 'Stabilimento', vettore: 'elettricita', uso: 'produzione', contratto: { potenza: 100, scadenza: '2026-02-28', penale: 300 } }], bollette,
  offerte: [{ id: 'o1', vettore: 'elettricita', fornitore: 'X', prezzo: 0.10, fissoMese: 10, costiCambio: 50, data: '2025-12-20' }, { id: 'o2', vettore: 'elettricita', fornitore: 'Y', prezzo: 0.14, fissoMese: 0, data: '2025-06-01' }] } };
let a = E.analisi(az, 2025, null, false, '2026-01-10');
const V = a.vettori.elettricita;
vicino('consumo annuo', V.consumo, 126000); vicino('spesa annua', V.spesa, 25200); vicino('costo medio 0,20 €/kWh', V.costoMedio, 0.2, 1e-9); vicino('costo della materia 0,12', V.costoMateria, 0.12, 1e-9);
vero('anno completo', V.completo && V.utenzeMesi === 12); vicino('quota F1', V.f1 / V.consumo, 0.6, 1e-9);
vicino('aumento del costo unitario +25%', V.varCosto, 0.25, 1e-9); vicino('variazione dei consumi +5%', V.varConsumo, 0.05, 1e-9);
vero('un solo mese anomalo: agosto +60%', a.anomalie.length === 1 && a.anomalie[0].mese === 8 && Math.abs(a.anomalie[0].scarto - 0.6) < 1e-9); vicino('costo dell\'anomalia', a.anomalie[0].costo, 6000 * 0.2);
vero('potenza eccessiva (40 kW su 100)', a.potenza.length === 1 && a.potenza[0].tipo === 'eccessiva');
vero('contratto in scadenza tra 49 giorni', a.scadenze.length === 1 && a.scadenze[0].giorni === 49);
// offerta X: 126.000 × 0,10 + 10 × 12 = 12.720 contro 15.120 di materia → risparmio 2.400; netto 2.400 − 50 − 300 = 2.050
const ox = a.offerte.find(x => x.o.id === 'o1'), oy = a.offerte.find(x => x.o.id === 'o2');
vicino('offerta X: costo', ox.costo, 12720); vicino('offerta X: risparmio', ox.risparmio, 2400); vicino('offerta X: netto di cambio e penale', ox.netto, 2050); vero('offerta X conviene e non è scaduta', ox.conviene && !ox.daRiverificare);
vicino('offerta Y: 126.000 × 0,14 = 17.640 → peggiore', oy.risparmio, 15120 - 17640); vero('offerta Y non conviene ed è da riverificare', !oy.conviene && oy.daRiverificare);
vero('criticità: offerta conveniente e costo in aumento', ['offerta_conveniente', 'costo_unitario_elettricita', 'consumi_anomali', 'potenza_eccessiva', 'contratto_in_scadenza'].every(id => a.criticita.some(x => x.id === id)), a.criticita.map(x => x.id).join());
// dopo la scadenza del contratto la penale non si applica più
vicino('senza penale dopo la scadenza', E.analisi(az, 2025, null, false, '2026-03-05').offerte.find(x => x.o.id === 'o1').netto, 2350);
// mesi mancanti: nessuna stima sull'anno
az.energia.bollette = bollette.filter(b => !(b.anno === 2025 && b.mese > 9));
a = E.analisi(az, 2025, null, false, '2026-01-10');
vero('nove mesi: anno non completo, consumi non riportati a dodici', !a.vettori.elettricita.completo && a.vettori.elettricita.consumo === 96000);
// bollette senza dettaglio: offerte non calcolabili
az.energia.bollette = bollette.map(b => ({ utenza: b.utenza, anno: b.anno, mese: b.mese, consumo: b.consumo, totale: b.totale }));
a = E.analisi(az, 2025, null, false, '2026-01-10');
vero('senza componenti: confronto offerte non calcolabile', a.offerte.every(x => !x.calcolabile) && a.vettori.elettricita.costoMateria === null);
// bolletta incoerente segnalata; spesa oltre i servizi di bilancio
az.energia.bollette = bollette.map((b, i) => i === 3 ? Object.assign({}, b, { totale: b.totale + 500 }) : b);
vero('bolletta incoerente segnalata', E.analisi(az, 2025, null, false, '2026-01-10').criticita[0].id === 'bollette_incoerenti');
az.energia.bollette = bollette;
const n = { ricavi: 500000, var_rim_prodotti: 0, altri_ricavi: 0, materie: 200000, var_rim_materie: 0, servizi: 20000, godimento: 0, personale: 100000, ammortamenti: 10000, svalutazioni_acc: 0, oneri_diversi: 0, proventi_fin: 0, oneri_fin: 0, rettifiche_fin: 0, imposte: 0 };
a = E.analisi(az, 2025, n, true, '2026-01-10');
vero('spesa oltre i servizi di bilancio', a.oltreServizi && a.criticita.some(x => x.id === 'energia_bilancio'));
a = E.analisi(az, 2025, Object.assign({}, n, { servizi: 100000 }), true, '2026-01-10');
vicino('incidenza sulla produzione', a.incidenzaProduzione, 25200 / 500000, 1e-9); vicino('quota dei servizi', a.quotaServizi, 0.252, 1e-9);
// collegamento con le commesse: prezzo usato 0,15 contro 0,20 reale; kWh attribuiti 30.000 su 126.000
az.commesse = { parametri: { prezzoKwh: 0.15 }, risorse: [{ id: 'm1', tipo: 'macchina', potenzaKw: 50, fattoreCarico: 0.5 }], elenco: [{ anno: 2025, ore: [{ risorsa: 'm1', ore: 400 }, { risorsa: 'm1', ore: 0, kwh: 20000 }] }] };
a = E.analisi(az, 2025, null, false, '2026-01-10');
vicino('kWh attribuiti alle commesse', a.commesse.kwhAttribuiti, 30000); vicino('quota attribuita', a.commesse.quota, 30000 / 126000, 1e-9); vero('prezzo del kWh non allineato', a.criticita.some(x => x.id === 'prezzo_kwh_commesse'));

// --- 2. importazione ---------------------------------------------------------------------------
const imp = E.daTabella(I.csv('Utenza;Vettore;Anno;Mese;Consumo;Materia;Trasporto;Oneri;Imposte;Totale\nStabilimento;elettricità;2025;gen;42.000;5.460;1.890;1.260;525;9.135\nRiscaldamento;gas;2025;1;3.100;;;;;2.852\nStabilimento;;2025;13;1;;;;;5\n;;;;;;;;;\n'), I.numero, []);
vero('import: due bollette e due utenze', imp.bollette.length === 2 && imp.utenze.length === 2, imp.bollette.length + '/' + imp.utenze.length);
vero('import: mese in lettere e numeri italiani', imp.bollette[0].mese === 1 && imp.bollette[0].consumo === 42000 && imp.bollette[0].totale === 9135);
vero('import: vettore riconosciuto', imp.utenze[0].vettore === 'elettricita' && imp.utenze[1].vettore === 'gas');
vero('import: mese non valido scartato e segnalato', imp.avvisi.some(x => /non sono state importate/.test(x)));
vero('import: utenza esistente riusata', E.daTabella(I.csv('Utenza;Anno;Mese;Totale\nstabilimento;2025;2;100\n'), I.numero, [{ id: 'u1', nome: 'Stabilimento' }]).bollette[0].utenza === 'u1');
vero('import: modello rileggibile', E.daTabella(I.csv(E.modelloCsv()), I.numero, []).bollette.length === 2);
vero('import: intestazione mancante', E.daTabella(I.csv('a;b\n1;2\n'), I.numero, []).bollette.length === 0);

// --- 3. utenze simulate ------------------------------------------------------------------------
let tot = 0, sup = 0, aziende = 0; const falliti = {};
for (const settore of Object.keys(S.SETTORI)) for (const profilo of Object.keys(S.PROFILI)) for (const seme of [3, 44, 505]) {
  const zz = S.genera({ settore, profilo, seme, anni: 3 }); zz.commesse = C.simula(zz, seme); zz.energia = E.simula(zz, seme);
  if (!zz.energia.bollette.length) continue; aziende++;
  const e = E.collaudo(zz).concat(C.collaudo(zz)); tot += e.length; sup += e.filter(x => x.ok).length;
  e.filter(x => !x.ok).forEach(x => { const kk = x.nome.replace(/^\d+ · /, ''); (falliti[kk] = falliti[kk] || []).push(settore + '/' + profilo + '/' + seme + ' ' + x.dettaglio); });
  const an = Math.max(...Object.keys(zz.esercizi).map(Number)), aa = E.analisi(zz, an, M.numeri(zz.esercizi[an]), true, (an + 1) + '-01-15');
  if (aa.commesse && (aa.commesse.quota > 1.001 || Math.abs(aa.commesse.scarto) > 0.10)) (falliti['coerenza con le commesse'] = falliti['coerenza con le commesse'] || []).push(settore + '/' + profilo + '/' + seme + ' quota ' + aa.commesse.quota + ' scarto ' + aa.commesse.scarto);
}
vero('collaudo utenze simulate ' + sup + '/' + tot, Object.keys(falliti).length === 0);
Object.keys(falliti).forEach(kk => console.log(falliti[kk].length, kk, '\n   ', falliti[kk].slice(0, 2).join('\n    ')));
console.log('\nTest energia superati: ' + ok + '  ·  falliti: ' + ko + '  ·  aziende con utenze simulate: ' + aziende + ' (' + sup + '/' + tot + ' controlli)');
process.exit(ko ? 1 : 0);
