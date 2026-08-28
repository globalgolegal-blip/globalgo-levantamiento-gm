// Comprueba los nueve contadores del tablero contra el conteo directo de los
// expedientes de `listar`. Sin abrir la pantalla: mirar la pantalla es lo que
// dejó pasar esto, porque ocho de nueve cuadraban y nadie suma nueve números a
// mano cada vez.
//
// El fixture usa datos LIMPIOS, a propósito. Un fixture sucio demuestra que un
// dato sucio produciría el síntoma, no que el dato real lo esté — es circular.
// Los estados reales llegan limpios: el anulado es A-N-U-L-A-D-O y nada más.
//
// Uso:
//   node scripts/verificar-contadores.mjs                  ← contra la hoja real
//        (necesita LGM_API_URL y LGM_SECRETO en el entorno)
//   node scripts/verificar-contadores.mjs --archivo x.json  ← contra un volcado
//   node scripts/verificar-contadores.mjs --fixture         ← contra datos limpios
//
//   --calculo-viejo   repite las comprobaciones con la derivación anterior
//                     (contadores sacados de `vivos` y ANULADO filtrado por
//                     área). Tiene que FALLAR: si pasa, esta prueba se quedó
//                     sin morder y no está comprobando nada.
//
// Sale con código 1 si algo no cuadra, para poder colgarlo de un build.

import { TARJETAS, ESTADO, ESTADOS_POR_ROL, COLOR_ESTADO, normalizarEstado } from '../app/_lgm/tokens.js';
import {
  contadores, normalizarExpedientes, normalizarConteos, esAnulado, vivosDe, porRolDe,
} from '../app/_lgm/contar.js';

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i === -1 ? null : (args[i + 1] || true); };
const VIEJO = args.includes('--calculo-viejo');

const CLAVES = TARJETAS.map(([c]) => c);
const ROLES = ['todos', ...Object.keys(ESTADOS_POR_ROL)];

// Los nueve valores internos de la hoja, escritos aparte a propósito: si
// alguien renombra una clave de la tabla de etiquetas, esto tiene que gritar.
const INTERNOS_DE_LA_HOJA = [
  'SOLICITADO', 'OBS. TESORERÍA', 'PAGO OK', 'EN TRÁMITE', 'EN NOTARÍA',
  'EN SUNARP', 'OBS. LEGAL', 'CERRADO', 'ANULADO',
];

let fallos = 0;
const mal = (m) => { fallos++; console.log('  x  ' + m); };
const bien = (m) => console.log('  ok ' + m);

const INVISIBLES = /[   ​﻿\t]/g;
const visible = (s) => JSON.stringify(String(s)).replace(
  INVISIBLES,
  (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
);

// La derivación ANTERIOR, tal como estaba: los contadores salían de `vivos`
// —que cambia con la tarjeta elegida— y ANULADO pasaba por el filtro de área.
// Está acá solo para comprobar, con --calculo-viejo, que estas pruebas muerden.
function contadoresViejos({ expedientes = [], conteos = {}, listado = false, rol = 'todos', estado = null }) {
  const porRol = rol === 'todos'
    ? vivosDe(expedientes, estado)
    : vivosDe(expedientes, estado).filter((e) => (ESTADOS_POR_ROL[rol] || []).includes(e.estado));
  const out = {};
  CLAVES.forEach((clave) => {
    const enVista = rol === 'todos' || (ESTADOS_POR_ROL[rol] || []).includes(clave);
    out[clave] = clave === 'ANULADO'
      ? (enVista ? (listado ? expedientes.filter(esAnulado).length : (conteos[clave] || 0)) : 0)
      : listado
        ? porRol.filter((e) => e.estado === clave).length
        : (enVista ? (conteos[clave] || 0) : 0);
  });
  return out;
}

const contar = VIEJO ? contadoresViejos : contadores;

/* -- 1. la tabla de etiquetas contra los valores internos de la hoja ------- */

console.log('\n1. Claves de la tabla de etiquetas vs valores internos de la hoja');
if (CLAVES.length !== INTERNOS_DE_LA_HOJA.length) {
  mal(`la tabla tiene ${CLAVES.length} tarjetas y la hoja ${INTERNOS_DE_LA_HOJA.length} estados`);
}
INTERNOS_DE_LA_HOJA.forEach((interno) => {
  if (!CLAVES.includes(interno)) mal(`la hoja tiene ${visible(interno)} y no hay tarjeta con esa clave`);
  else if (!ESTADO[interno]) mal(`${visible(interno)} no tiene fila en la tabla ESTADO`);
});
CLAVES.forEach((clave) => {
  if (!INTERNOS_DE_LA_HOJA.includes(clave)) mal(`la tarjeta ${visible(clave)} no es un estado de la hoja`);
});
if (!fallos) bien(`las ${CLAVES.length} claves coinciden exactamente, código por código`);

/* -- 2. la normalización no funde estados (higiene, no la causa) ----------- */

const antes2 = fallos;
console.log('\n2. La normalización de estados no funde estados distintos');
const destinos = new Map();
Object.keys(COLOR_ESTADO).forEach((e) => {
  const d = normalizarEstado(e);
  if (destinos.has(d)) mal(`${visible(e)} y ${visible(destinos.get(d))} caen en el mismo valor ${visible(d)}`);
  destinos.set(d, e);
  if (d !== e) mal(`${visible(e)} no se normaliza a sí mismo, da ${visible(d)}`);
});
if (normalizarEstado('EN ARCHIVO') !== 'EN ARCHIVO') mal('un estado desconocido no se conserva tal cual');
if (fallos === antes2) bien('los diez estados siguen distintos y un estado desconocido se conserva');

/* -- 3. de dónde salen los datos ------------------------------------------- */

// Datos LIMPIOS: es como llegan de verdad. Un expediente por estado, más un
// segundo anulado para que el número no se confunda con un 1 de casualidad.
function fixture() {
  const estados = [...INTERNOS_DE_LA_HOJA, 'ANULADO', 'LEVANTADO'];
  const expedientes = estados.map((estado, i) => ({
    id: 'LGM-2026-' + String(i + 1).padStart(4, '0'), estado,
  }));
  const conteos = {};                          // igual que resumenPublico_
  expedientes.forEach((e) => { conteos[e.estado] = (conteos[e.estado] || 0) + 1; });
  return { expedientes, conteos };
}

async function traer() {
  if (args.includes('--fixture')) return { ...fixture(), origen: 'fixture con datos limpios' };

  const archivo = opcion('--archivo');
  if (archivo && archivo !== true) {
    const { readFileSync } = await import('node:fs');
    const d = JSON.parse(readFileSync(archivo, 'utf8'));
    return { expedientes: d.expedientes || [], conteos: d.conteos || {}, origen: archivo };
  }

  const url = process.env.LGM_API_URL;
  const secreto = process.env.LGM_SECRETO;
  if (!url || !secreto) {
    console.log('\n(sin LGM_API_URL / LGM_SECRETO y sin --archivo: corro el fixture)');
    return { ...fixture(), origen: 'fixture con datos limpios' };
  }
  const r = await fetch(url + '?k=' + encodeURIComponent(secreto), { cache: 'no-store' });
  const d = await r.json();
  if (d.error) throw new Error('la hoja respondió: ' + d.error);
  return { expedientes: d.expedientes || [], conteos: d.conteos || {}, origen: url };
}

const { expedientes: crudos, conteos: conteosCrudos, origen } = await traer();

console.log(`\n3. Inventario de estados tal como llegan (origen: ${origen})`);
if (!crudos.length) mal('`listar` no trajo ningún expediente: no hay nada que comparar');
const inventario = new Map();
crudos.forEach((e) => {
  const k = String(e.estado ?? '');
  inventario.set(k, (inventario.get(k) || 0) + 1);
});
[...inventario.entries()].sort().forEach(([crudo, n]) => {
  const destino = normalizarEstado(crudo);
  const nota = crudo === destino ? '' : `-> ${visible(destino)}   (la celda trae basura)`;
  console.log(`  ${String(n).padStart(4)}  ${visible(crudo).padEnd(26)}${nota}`);
});

const expedientes = normalizarExpedientes(crudos);
const conteos = normalizarConteos(conteosCrudos);

// El conteo de referencia: un bucle sobre los expedientes de `listar` y nada
// más. No pasa por contadores() ni por el estado de la pantalla.
const real = {};
CLAVES.forEach((c) => { real[c] = 0; });
let sinTarjeta = 0;
expedientes.forEach((e) => {
  if (Object.prototype.hasOwnProperty.call(real, e.estado)) real[e.estado]++;
  else sinTarjeta++;
});

/* -- 4. los nueve contadores contra el conteo directo de listar ------------ */

console.log(`\n4. Los nueve contadores vs el conteo directo de listar${VIEJO ? '   [CALCULO VIEJO]' : ''}`);
const n = contar({ expedientes, conteos, listado: true, rol: 'todos', estado: null });
console.log('  ' + 'tarjeta'.padEnd(20) + 'contador'.padStart(9) + 'listar'.padStart(9));
let cuadran = 0;
CLAVES.forEach((clave) => {
  const ok = n[clave] === real[clave];
  if (ok) cuadran++; else fallos++;
  console.log(`  ${ESTADO[clave].contador.padEnd(20)}${String(n[clave]).padStart(9)}${String(real[clave]).padStart(9)}   ${ok ? 'ok' : 'x'}`);
});
console.log(`  -> cuadran ${cuadran} de ${CLAVES.length}`);

const suma = CLAVES.reduce((a, c) => a + n[c], 0);
if (suma + sinTarjeta !== expedientes.length) {
  mal(`los nueve suman ${suma}, más ${sinTarjeta} sin tarjeta, y listar trajo ${expedientes.length}`);
} else {
  bien(`${suma} en tarjetas + ${sinTarjeta} sin tarjeta (LEVANTADO y desconocidos) = ${expedientes.length} de listar`);
}

/* -- 5. un contador no cambia por la tarjeta que esté elegida -------------- */

// Este es el que faltaba: «Pago validado» leía 1 y después 0 sin que nada
// cambiara en la hoja, porque los contadores salían de la lista de la pantalla
// y la lista cambia con la tarjeta elegida.
console.log('\n5. Elegir una tarjeta no puede cambiar ningún contador');
const antes5 = fallos;
ROLES.forEach((rol) => {
  const base = contar({ expedientes, conteos, listado: true, rol, estado: null });
  [...CLAVES, null].forEach((sel) => {
    const m = contar({ expedientes, conteos, listado: true, rol, estado: sel });
    const movidos = CLAVES.filter((c) => m[c] !== base[c]);
    if (movidos.length) {
      mal(`rol ${rol}: con ${ESTADO[sel].contador} elegido se mueven ${movidos.map((c) => `${ESTADO[c].contador} ${base[c]}->${m[c]}`).join(', ')}`);
    }
  });
});
if (fallos === antes5) bien('ningún contador se mueve al elegir cualquiera de las nueve tarjetas');

/* -- 6. Anulados se cuenta desde cualquier Vista --------------------------- */

console.log('\n6. Anulados se cuenta y se lista desde cualquier Vista');
const antes6 = fallos;
ROLES.forEach((rol) => {
  const m = contar({ expedientes, conteos, listado: true, rol, estado: null });
  if (m['ANULADO'] !== real['ANULADO']) {
    mal(`rol ${rol}: la tarjeta Anulados dice ${m['ANULADO']} y listar tiene ${real['ANULADO']}`);
  }
  // Y al hacer clic en la tarjeta, la lista no puede salir vacía.
  const lista = porRolDe(vivosDe(expedientes, 'ANULADO'), rol);
  if (lista.length !== real['ANULADO']) {
    mal(`rol ${rol}: al elegir Anulados la lista trae ${lista.length} y hay ${real['ANULADO']}`);
  }
});
if (fallos === antes6) bien(`comprobado en las ${ROLES.length} Vistas (hay ${real['ANULADO']} anulado(s))`);

/* -- 7. las dos fuentes tienen que decir lo mismo -------------------------- */

// Los conteos del render del servidor y el detalle de `listar` se pintan en las
// mismas nueve tarjetas. Si no coinciden, la tarjeta cambia de número sola en
// cuanto llega el detalle, sin que nada haya pasado en la hoja.
console.log('\n7. Conteos del servidor y detalle de listar dicen lo mismo');
ROLES.forEach((rol) => {
  const conDetalle = contar({ expedientes, conteos, listado: true, rol, estado: null });
  const sinDetalle = contar({ expedientes, conteos, listado: false, rol, estado: null });
  const difieren = CLAVES.filter((c) => conDetalle[c] !== sinDetalle[c]);
  if (difieren.length) {
    mal(`rol ${rol}: ${difieren.map((c) => `${ESTADO[c].contador} ${sinDetalle[c]}/${conDetalle[c]}`).join(', ')}`);
  } else {
    bien(`rol ${rol}: las dos fuentes coinciden en los nueve`);
  }
});

console.log(fallos ? `\nFALLA - ${fallos} comprobacion(es) no cuadran\n` : '\nTODO CUADRA\n');
process.exit(fallos ? 1 : 0);
