// Comprueba los contadores del tablero contra el conteo directo de los
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

import { TARJETAS, ESTADO, AREAS, COLOR_ESTADO, normalizarEstado, claveArea } from '../app/_lgm/tokens.js';
import {
  contadores, normalizarExpedientes, normalizarConteos, esAnulado, vivosDe, agrupar,
} from '../app/_lgm/contar.js';

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i === -1 ? null : (args[i + 1] || true); };
const VIEJO = args.includes('--calculo-viejo');

const CLAVES = TARJETAS.map(([c]) => c);
// El selector de Vista se quitó, pero los contadores tienen que seguir dando lo
// mismo pasen lo que les pasen: si alguien vuelve a meterles un área, esto falla.
const ROLES = ['todos', ...AREAS.map(([clave]) => clave)];

// Los nueve valores internos de la hoja, escritos aparte a propósito: si
// alguien renombra una clave de la tabla de etiquetas, esto tiene que gritar.
const INTERNOS_DE_LA_HOJA = [
  'SOLICITADO', 'OBS. TESORERÍA', 'PAGO OK', 'EN TRÁMITE', 'EN NOTARÍA',
  'EN SUNARP', 'OBS. LEGAL', 'OBS. COBRANZA', 'CERRADO', 'ANULADO',
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
// La tabla que alimentaba el filtro por área, sólo para poder reproducir el
// error de entonces. En la aplicación ya no existe — ver el comentario que dejó
// su hueco en tokens.js.
const POR_ROL_DE_ENTONCES = {
  cobranza:  ['SOLICITADO', 'OBS. TESORERÍA', 'OBS. LEGAL', 'LEVANTADO', 'CERRADO'],
  tesoreria: ['SOLICITADO', 'OBS. TESORERÍA', 'PAGO OK', 'CERRADO'],
  legal:     ['PAGO OK', 'EN TRÁMITE', 'EN NOTARÍA', 'EN SUNARP', 'OBS. LEGAL', 'OBS. COBRANZA',
              'LEVANTADO', 'CERRADO', 'ANULADO'],
};

function contadoresViejos({ expedientes = [], conteos = {}, listado = false, rol = 'todos', estado = null }) {
  const porRol = rol === 'todos'
    ? vivosDe(expedientes, estado)
    : vivosDe(expedientes, estado).filter((e) => (POR_ROL_DE_ENTONCES[rol] || []).includes(e.estado));
  const out = {};
  CLAVES.forEach((clave) => {
    const enVista = rol === 'todos' || (POR_ROL_DE_ENTONCES[rol] || []).includes(clave);
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

console.log(`\n4. Los ${CLAVES.length} contadores vs el conteo directo de listar${VIEJO ? '   [CALCULO VIEJO]' : ''}`);
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
  mal(`los ${CLAVES.length} suman ${suma}, más ${sinTarjeta} sin tarjeta, y listar trajo ${expedientes.length}`);
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
if (fallos === antes5) bien(`ningún contador se mueve al elegir cualquiera de las ${CLAVES.length} tarjetas`);

/* -- 6. los contadores no dependen de nada -------------------------------- */

console.log('\n6. Los contadores son globales y no dependen de ninguna área');
const antes6 = fallos;
ROLES.forEach((rol) => {
  // `contadores` ya no acepta un área, y esto lo mantiene así: se le pasa una
  // igual, y tiene que dar exactamente lo mismo que el conteo directo. Si
  // alguien vuelve a hacer que los contadores dependan del área, esto falla.
  const m = contar({ expedientes, conteos, listado: true, rol, estado: null });
  const apagados = CLAVES.filter((c) => m[c] !== real[c]);
  if (apagados.length) {
    mal(`con área ${rol}: ${apagados.map((c) => `${ESTADO[c].contador} dice ${m[c]} y hay ${real[c]}`).join(', ')}`);
  }
});

// Y el listado de cada tarjeta tiene que dar el número de esa tarjeta. Ya no hay
// filtro de área que lo pueda vaciar: elegir una tarjeta filtra por estado, y
// nada más.
const descuadran = CLAVES.filter((c) => {
  const lista = vivosDe(expedientes, c).filter((x) => x.estado === c);
  return lista.length !== real[c];
});
if (descuadran.length) {
  mal(`al elegir ${descuadran.map((c) => ESTADO[c].contador).join(', ')} el listado no da el número de la tarjeta`);
}
if (fallos === antes6) {
  bien(`los ${CLAVES.length} dan lo mismo con cualquier área, y el listado de cada tarjeta cuadra con ella`);
}

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
    bien(`rol ${rol}: las dos fuentes coinciden en los ${CLAVES.length}`);
  }
});

/* -- 8. el listado NO esconde nada ---------------------------------------- */

// Este control está al revés de como estaba, y a propósito.
//
// Antes comprobaba que el listado filtrara por Vista. Ese filtro se quitó: era
// el que escondía LGM-2026-0007 —PAGO OK, responsable Legal— de Cobranza, que es
// justamente quien tiene que observarlo cuando el cliente desiste. Un filtro
// automático por área vuelve el desistimiento imposible de pedir.
//
// Ahora hay UNA lista con todo, en tres grupos que son orden y no filtro. Lo que
// hay que comprobar es lo contrario: que la suma de los tres grupos sea la lista
// completa, con cualquier área de sesión, y que nadie caiga fuera.
console.log('\n8. El listado no esconde nada: los tres grupos suman la lista completa');
const antes8 = fallos;

// Un expediente por cada responsable que la hoja puede devolver, incluidos los
// que no son áreas del tablero y el vacío que devuelve la fórmula cuando su
// rango de búsqueda se queda corto.
const RESPONSABLES = ['Cobranza', 'Tesorería', 'Legal', 'Notaría Quintanilla', 'SUNARP', '—', '', '   '];
const muestra = RESPONSABLES.map((responsable, i) => ({
  id: 'LGM-2026-9' + String(i).padStart(3, '0'),
  estado: 'PAGO OK',
  responsable,
}));

[null, 'cobranza', 'tesoreria', 'legal'].forEach((area) => {
  const { anomalias, teToca, resto } = agrupar(muestra, area);
  const total = anomalias.length + teToca.length + resto.length;
  if (total !== muestra.length) {
    mal(`área ${area}: los tres grupos suman ${total} y la lista tiene ${muestra.length}`);
  }
  // Y ninguno puede estar en dos grupos a la vez.
  const ids = [...anomalias, ...teToca, ...resto].map((e) => e.id);
  if (new Set(ids).size !== ids.length) mal(`área ${area}: hay un expediente en dos grupos`);

  // El responsable vacío es una anomalía y se ve; nunca se pierde.
  const vacios = muestra.filter((e) => !claveArea(e.responsable));
  vacios.forEach((e) => {
    if (!anomalias.some((x) => x.id === e.id)) {
      mal(`área ${area}: el expediente sin responsable ${e.id} no está en anomalías`);
    }
  });

  // «Notaría Quintanilla» y «SUNARP» no son áreas del tablero: van al resto.
  ['notaria quintanilla', 'sunarp', '—'].forEach((r) => {
    const e = muestra.find((x) => claveArea(x.responsable) === r);
    if (e && !resto.some((x) => x.id === e.id)) {
      mal(`área ${area}: ${e.responsable} no cayó en el resto`);
    }
  });
});

// Y el caso del desistimiento, nombrado: un OBS. COBRANZA le tiene que aparecer
// a Cobranza, que no es su responsable, para poder seguirlo.
const conObsCobranza = [{ id: 'X', estado: 'OBS. COBRANZA', responsable: 'Legal' }];
const paraCobranza = agrupar(conObsCobranza, 'cobranza');
if (paraCobranza.anomalias.length + paraCobranza.teToca.length + paraCobranza.resto.length !== 1) {
  mal('un OBS. COBRANZA desaparece de la lista de Cobranza');
}
if (fallos === antes8) {
  bien(`los tres grupos suman la lista con las ${4} sesiones probadas, y nadie se pierde`);
}

console.log(fallos ? `\nFALLA - ${fallos} comprobacion(es) no cuadran\n` : '\nTODO CUADRA\n');
process.exit(fallos ? 1 : 0);
