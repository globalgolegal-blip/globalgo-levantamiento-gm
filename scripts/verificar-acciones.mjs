// Imprime qué botones se le ofrecen a cada área en cada estado, y comprueba las
// reglas que no se ven mirando la pantalla de a un expediente por vez.
//
// No comprueba permisos: el servidor es la autoridad y vuelve a comprobar área
// y estado en cada llamada. Comprueba que el tablero no ofrezca cosas
// imposibles ni esconda cosas posibles.
//
//   npm run verificar-acciones

import { ESTADO, AREAS, OBSERVADOS, claveArea, esElMismoNombre } from '../app/_lgm/tokens.js';
import {
  puedeCorregir, puedeResponder, puedeReemplazarComprobante,
  puedeAnular, puedeObservar, trasElPago,
} from '../app/_lgm/acciones.js';

let fallos = 0;
const mal = (m) => { fallos++; console.log('  x  ' + m); };
const bien = (m) => console.log('  ok ' + m);

// El responsable de cada estado, tal como lo calcula la hoja desde Catalogos.
const RESPONSABLE = {
  'SOLICITADO':     'Tesorería',
  'OBS. TESORERÍA': 'Cobranza',
  'PAGO OK':        'Legal',
  'EN TRÁMITE':     'Legal',
  'EN NOTARÍA':     'Notaría Quintanilla',
  'EN SUNARP':      'SUNARP',
  'OBS. LEGAL':     'Cobranza',
  'OBS. COBRANZA':  'Legal',
  'LEVANTADO':      'Sistema',
  'CERRADO':        '—',
  'ANULADO':        '—',
};

// Un expediente por estado. fechaValidacion puesta desde PAGO OK en adelante,
// que es como queda en la hoja: la escribe `validar` y nadie la borra.
const ANTES_DEL_PAGO = ['SOLICITADO', 'OBS. TESORERÍA'];
const expedienteEn = (estado) => ({
  id: 'LGM-2026-0000',
  estado,
  responsable: RESPONSABLE[estado],
  fechaValidacion: ANTES_DEL_PAGO.includes(estado) ? '' : '2026-08-20T10:00:00Z',
});

const ESTADOS = Object.keys(RESPONSABLE);
const BOTONES = [
  ['Corregir',    puedeCorregir],
  ['Responder',   puedeResponder],
  ['Comprobante', puedeReemplazarComprobante],
  ['Observar',    puedeObservar],
  ['Anular',      puedeAnular],
];

/* -- la tabla ------------------------------------------------------------- */

// Los cinco botones que decide acciones.js. Los demás siguen en el JSX con su
// condición propia y NO salen en esta tabla, así que no hay que leerla como
// completa:
//   Validar pago            Tesorería, SOLICITADO
//   Levantar en SIGM        Legal, PAGO OK y régimen NUEVA
//   Ingreso a notaría       Legal, PAGO OK o EN TRÁMITE y régimen ANTIGUA
//   N° de título            Legal, EN NOTARÍA
//   Cargar boleta y cerrar  Legal, EN TRÁMITE con régimen NUEVA, o EN SUNARP
//   Reabrir expediente      Legal, ANULADO
// Dependen del régimen o abren un formulario de Google; esta ronda no los toca.
console.log('\nSolo los cinco botones de acciones.js. Validar pago, SIGM, notaría, título,');
console.log('cerrar y reabrir tienen su condición en el JSX y no salen en esta tabla.');

AREAS.forEach(([area, nombre]) => {
  console.log(`\nVista ${nombre}`);
  console.log('  ' + 'estado'.padEnd(16) + BOTONES.map(([n]) => n.padStart(13)).join(''));
  ESTADOS.forEach((estado) => {
    const e = expedienteEn(estado);
    const fila = BOTONES.map(([, f]) => (f(e, area) ? 'sí' : '·').padStart(13)).join('');
    console.log('  ' + estado.padEnd(16) + fila);
  });
});

/* -- las reglas ----------------------------------------------------------- */

console.log('\nReglas');

// 1. Un expediente terminado no admite nada.
['CERRADO', 'LEVANTADO', 'ANULADO'].forEach((estado) => {
  const e = expedienteEn(estado);
  AREAS.forEach(([area]) => {
    const ofrecidos = BOTONES.filter(([, f]) => f(e, area)).map(([n]) => n);
    if (ofrecidos.length) mal(`${estado} le ofrece ${ofrecidos.join(', ')} a ${area}`);
  });
});

// 2. La línea es el dinero: Cobranza anula antes del pago y observa después.
//    Nunca las dos cosas, y nunca ninguna en un expediente vivo suyo.
ESTADOS.forEach((estado) => {
  const e = expedienteEn(estado);
  const anula = puedeAnular(e, 'cobranza');
  const observa = puedeObservar(e, 'cobranza');
  if (anula && observa) mal(`${estado}: Cobranza puede anular Y observar a la vez`);
  if (anula && trasElPago(e)) mal(`${estado}: Cobranza puede anular con el pago ya validado`);
  if (observa && !trasElPago(e)) mal(`${estado}: Cobranza puede observar antes del pago`);
});

// 3. Un expediente ya observado no se vuelve a observar, por nadie.
OBSERVADOS.forEach((estado) => {
  const e = expedienteEn(estado);
  AREAS.forEach(([area]) => {
    if (puedeObservar(e, area)) mal(`${estado} ya está observado y ${area} puede observarlo otra vez`);
  });
});

// 4. Toda observación tiene exactamente un área que puede resolverla. Si
//    ninguna puede, el expediente queda parado sin que nadie lo sepa — es el
//    callejón sin salida del desistimiento.
OBSERVADOS.forEach((estado) => {
  const e = expedienteEn(estado);
  const resuelven = AREAS.filter(([area]) => puedeResponder(e, area)).map(([, n]) => n);
  if (resuelven.length !== 1) {
    mal(`${estado}: lo pueden resolver ${resuelven.length ? resuelven.join(' y ') : 'nadie'}`);
  } else {
    bien(`${estado} lo resuelve ${resuelven[0]}, y solo ${resuelven[0]}`);
  }
});

// 5. Donde se puede responder se puede corregir, y al revés: la observación
//    dice qué corregir, así que responder sin poder corregir es el callejón de
//    LGM-2026-0003 — el sistema ordena corregir y no ofrece cómo.
ESTADOS.forEach((estado) => {
  const e = expedienteEn(estado);
  AREAS.forEach(([area, nombre]) => {
    if (puedeResponder(e, area) !== puedeCorregir(e, area)) {
      mal(`${estado} / ${nombre}: responder y corregir no van juntos`);
    }
  });
});

// 6. Cada estado observado tiene etiqueta, contador y color. Un estado que el
//    tablero no conoce se pinta con su valor interno y no tiene tarjeta.
OBSERVADOS.forEach((estado) => {
  if (!ESTADO[estado]) mal(`${estado} no tiene fila en la tabla ESTADO`);
});

// 7. Tesorería puede observar un SOLICITADO. Es como rechaza un depósito que no
//    cuadra, y es la observación más frecuente del sistema: sin ella, un
//    depósito equivocado no tiene forma de volver a Cobranza. Su condición no
//    pasa por la fecha de validación, que en SOLICITADO está vacía por
//    definición — de ahí que esto esté fijado y no inferido.
if (!puedeObservar(expedienteEn('SOLICITADO'), 'tesoreria')) {
  mal('Tesorería NO puede observar un SOLICITADO: se apagó el rechazo de depósitos');
} else {
  bien('Tesorería puede observar un SOLICITADO');
}

// Y la decisión deliberada del otro lado: Legal no observa lo que todavía está
// en manos de Tesorería, aunque el servidor lo permita.
if (puedeObservar(expedienteEn('SOLICITADO'), 'legal')) {
  mal('Legal puede observar un SOLICITADO: era una decisión que no, revisa acciones.js');
} else {
  bien('Legal no observa un SOLICITADO — decisión, no efecto colateral');
}

// 8. claveArea, con los nombres reales de la hoja y sus acentos.
//
//    Está acá porque este error ya apareció dos veces: la expresión que quita
//    los diacríticos se escribió una vez con los caracteres combinantes
//    LITERALES en el rango, en vez de ̀-ͯ. Funciona igual, pero son
//    dos caracteres invisibles en un archivo que se copia y se pega, y si se
//    rompen «Tesorería» deja de reconocerse — y con eso, quien tiene el
//    expediente en el escritorio deja de ver sus botones. No da error: deja a
//    alguien sin poder trabajar.
console.log('\nclaveArea con los nombres de la hoja');
const antes8 = fallos;
[
  ['Cobranza',  'cobranza'],
  ['Tesorería', 'tesoreria'],
  ['Legal',     'legal'],
  // Y los responsables que NO son un área del tablero: no deben caer en
  // ninguna clave, porque ahí no hay botones que ofrecer.
  ['Notaría Quintanilla', 'notaria quintanilla'],
  ['SUNARP', 'sunarp'],
  ['—', '—'],
].forEach(([enLaHoja, esperado]) => {
  const sale = claveArea(enLaHoja);
  if (sale !== esperado) mal(`claveArea('${enLaHoja}') dio '${sale}' y debía dar '${esperado}'`);
});
// Y que las tres claves del tablero sean exactamente las que produce claveArea
// desde el nombre en pantalla: si se separan, el responsable de la hoja no
// coincide con el área de la sesión y nadie ve nada.
AREAS.forEach(([clave, nombre]) => {
  if (claveArea(nombre) !== clave) {
    mal(`el nombre '${nombre}' da '${claveArea(nombre)}' y la clave del tablero es '${clave}'`);
  }
});
if (fallos === antes8) bien('los tres nombres con acento caen en su clave, y los no-áreas en ninguna');

// 9. La cabecera de una observación no repite el nombre y el área.
//
//    Pasó dos veces: «LEGAL  Legal» primero, y después «COBRANZAS Cobranza»,
//    porque la comparación exacta no veía la ese del plural. Y la otra mitad
//    importa igual: un nombre de persona NO puede confundirse con un área, o el
//    área desaparecería de la cabecera y no se sabría quién observó desde dónde.
console.log('\nLa cabecera de una observación: nombre vs área');
const antes9 = fallos;
[
  // [usuario, área, ¿es la misma palabra?]
  ['LEGAL',     'Legal',     true],
  ['COBRANZAS', 'Cobranza',  true],
  ['COBRANZA',  'Cobranza',  true],
  ['TESORERIA', 'Tesorería', true],
  ['TESORERÍA', 'Tesorería', true],
  ['ALONSO',    'Legal',     false],
  ['DIANA',     'Cobranza',  false],
  ['LUCIA',     'Tesorería', false],
  ['',          'Legal',     false],
].forEach(([usuario, area, esperado]) => {
  const sale = esElMismoNombre(area, usuario);
  if (sale !== esperado) {
    mal(`«${usuario}» y «${area}»: dio ${sale} y se esperaba ${esperado}`);
  }
});
if (fallos === antes9) bien('el plural no engaña, y ningún nombre de persona se confunde con un área');

if (!fallos) bien('las nueve reglas se cumplen');
console.log(fallos ? `\nFALLA - ${fallos} problema(s)\n` : '\nTODO CUADRA\n');
process.exit(fallos ? 1 : 0);
