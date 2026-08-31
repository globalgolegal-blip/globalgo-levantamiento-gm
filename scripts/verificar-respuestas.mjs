// Comprueba el contrato de «el servidor no habló claro»: las dos mitades y los
// tres caminos.
//
//   npm run verificar-respuestas
//
// La mitad del servidor (esRespuestaUsable, en app/api/lgm/route.js) y la del
// cliente (sinRespuestaClara, en el tablero) tienen que encajar. Si encajan mal
// vuelve el error que costó una corrección: la ruta pasaba el `{}` de Apps
// Script tal cual y el tablero decía «No se pudo guardar» sobre un cambio que SÍ
// se había guardado en la hoja. Con corregir da igual; con observar, la persona
// lo repite y quedan dos observaciones y una vuelta de más en el expediente.
//
// Y el predicado es NEUTRO: lo mismo que para escribir vale para leer y para
// entrar, pero cada uno tiene que decir otra cosa. Un solo texto daba mensajes
// absurdos —«no sé si el cambio se guardó» cuando nadie estaba guardando nada—
// y, peor, un `listar` ilegible caía en la rama del token y cerraba la sesión.

import { readFileSync } from 'node:fs';
import {
  esRespuestaUsable, sinRespuestaClara,
  AVISO_ESCRITURA, AVISO_LECTURA, AVISO_INGRESO, AVISO_NEUTRO,
} from '../app/_lgm/respuesta.js';

let fallos = 0;
const mal = (m) => { fallos++; console.log('  x  ' + m); };
const bien = (m) => console.log('  ok ' + m);

/* -- 1. qué contestó la hoja: ¿se puede interpretar? ---------------------- */

console.log('\n1. La ruta reconoce lo que no se puede interpretar');
const antes1 = fallos;
[
  [{ ok: true, mensaje: 'Observado.' },                  true,  'una respuesta normal'],
  [{ ok: false, error: 'Esta acción es de Tesorería.' }, true,  'un rechazo con motivo'],
  [{ ok: false },                                        true,  'un rechazo sin texto'],
  [{},                                                   false, 'el {} que se vio de verdad'],
  [null,                                                 false, 'null'],
  [undefined,                                            false, 'undefined'],
  ['',                                                   false, 'una cadena vacía'],
  ['ok',                                                 false, 'texto suelto'],
  [0,                                                    false, 'un número'],
  [{ mensaje: 'listo' },                                 false, 'un objeto sin ok'],
].forEach(([data, esperado, que]) => {
  if (esRespuestaUsable(data) !== esperado) {
    mal(`${que}: esRespuestaUsable dio ${!esperado} y debía dar ${esperado}`);
  }
});
if (fallos === antes1) bien('reconoce el {} y cualquier otra respuesta sin `ok`');

/* -- 2. el predicado del cliente ------------------------------------------ */

console.log('\n2. El cliente no afirma nada cuando el servidor no habló claro');
const antes2 = fallos;
[
  [{ ok: false, motivo: 'indeterminado', error: AVISO_NEUTRO }, true,  'la hoja contestó algo ilegible'],
  [{ ok: false, motivo: 'conexion', error: 'Sin conexión con el servidor' }, true, 'se cayó el transporte'],
  [{ ok: false, motivo: 'conexion', error: 'El servicio no respondió tras varios intentos.' }, true, 'la hoja no respondió'],

  // Rechazos de verdad: el servidor habló y dijo no. A eso se le cree.
  [{ ok: false, error: 'Esta acción es de Tesorería.' },      false, 'un rechazo por área'],
  [{ ok: false, error: 'Este expediente está en SOLICITADO y no admite esta acción' }, false, 'un rechazo por estado'],
  [{ ok: false, error: 'PIN incorrecto. Te quedan 8 intentos.' }, false, 'un PIN incorrecto'],
  [{ ok: false, error: 'Tu sesión venció. Vuelve a identificarte.' }, false, 'un token vencido'],
  [{ ok: true, mensaje: 'Observado.' },                       false, 'un éxito'],
].forEach(([r, esperado, que]) => {
  if (sinRespuestaClara(r) !== esperado) {
    mal(`${que}: sinRespuestaClara dio ${!esperado} y debía dar ${esperado}`);
  }
});
if (fallos === antes2) bien('solo cuando no habló claro; un rechazo con motivo se respeta');

/* -- 3. tres caminos, tres mensajes --------------------------------------- */

// El mismo predicado, tres significados. Escribir es el único caso grave.
console.log('\n3. Escribir, leer y entrar dicen cosas distintas');
const antes3 = fallos;

const tres = [
  ['ESCRITURA', AVISO_ESCRITURA],
  ['LECTURA',   AVISO_LECTURA],
  ['INGRESO',   AVISO_INGRESO],
];
// Ninguno puede ser igual a otro: si dos coinciden, alguien reutilizó el texto
// equivocado y volvemos a «no sé si el cambio se guardó» cuando se estaba leyendo.
tres.forEach(([a, txtA], i) => {
  tres.slice(i + 1).forEach(([b, txtB]) => {
    if (txtA === txtB) mal(`el aviso de ${a} y el de ${b} son el mismo texto`);
  });
});

// Solo el de escritura advierte del riesgo de repetir, porque es el único que lo
// tiene: leer y entrar se repiten sin consecuencias.
if (!/dos veces/.test(AVISO_ESCRITURA)) mal('el aviso de escritura no advierte que repetir duplica el cambio');
if (/dos veces|guardó/.test(AVISO_LECTURA)) mal('el aviso de lectura habla de guardar, y no se estaba guardando nada');
if (/guardó/.test(AVISO_INGRESO)) mal('el aviso de ingreso habla de guardar');

// El de lectura tiene que decir que la sesión sigue abierta: es lo contrario de
// lo que decía antes, cuando cerraba la sesión con un «Tu sesión venció» falso.
if (!/sesión sigue abierta/i.test(AVISO_LECTURA)) mal('el aviso de lectura no dice que la sesión sigue abierta');

// El de ingreso no puede acusar al PIN: no se sabe si el intento llegó.
if (!/no es que el PIN esté mal/i.test(AVISO_INGRESO)) mal('el aviso de ingreso no aclara que el PIN puede estar bien');

// Y ninguno habla de detalles que quien lo lee no puede usar.
tres.forEach(([que, txt]) => {
  if (/\{\}|JSON|cuerpo vacío|status|502|undefined/i.test(txt)) {
    mal(`el aviso de ${que} habla de detalles técnicos`);
  }
});
if (fallos === antes3) bien('tres textos distintos: solo escribir advierte del riesgo de repetir');

/* -- 4. leer NO puede cerrar la sesión ------------------------------------ */

// Esto se comprueba sobre el código, porque es el orden de las ramas lo que
// falla: la de `sinRespuestaClara` tiene que ir ANTES de la que borra la sesión.
console.log('\n4. Un listar ilegible no cierra la sesión');
const antes4 = fallos;
const tablero = readFileSync('app/_lgm/TableroLGM.jsx', 'utf8');
const cargar = tablero.slice(
  tablero.indexOf('async function cargarListado'),
  tablero.indexOf('useEffect', tablero.indexOf('async function cargarListado'))
);
const iPredicado = cargar.indexOf('sinRespuestaClara');
const iCierre = cargar.indexOf('localStorage.removeItem');
if (iPredicado === -1) {
  mal('cargarListado no distingue una respuesta ilegible: caería en la rama del token');
} else if (iCierre !== -1 && iPredicado > iCierre) {
  mal('la rama que cierra la sesión va antes: un listar ilegible echaría a la persona');
} else if (!cargar.includes('AVISO_LECTURA')) {
  mal('cargarListado no usa el aviso de lectura');
} else {
  bien('la rama de respuesta ilegible va primero, conserva la sesión y usa su propio aviso');
}

/* -- 5. la cadena completa ------------------------------------------------ */

console.log('\n5. La cadena: hoja -> ruta -> cliente');
const antes5 = fallos;
const loQueMandaLaRuta = (deLaHoja) => (
  esRespuestaUsable(deLaHoja)
    ? deLaHoja
    : { ok: false, motivo: 'indeterminado', error: AVISO_NEUTRO }
);
[
  [{},                                                  'no habló claro', 'el {} de Apps Script'],
  [{ ok: true, mensaje: 'Observado.' },                 'ok',             'una observación guardada'],
  [{ ok: false, error: 'Esta acción es de Tesorería.' }, 'rechazo',       'un rechazo del servidor'],
].forEach(([deLaHoja, esperado, que]) => {
  const alCliente = loQueMandaLaRuta(deLaHoja);
  const conclusion = sinRespuestaClara(alCliente) ? 'no habló claro' : alCliente.ok ? 'ok' : 'rechazo';
  if (conclusion !== esperado) mal(`${que}: la cadena concluyó «${conclusion}» y debía concluir «${esperado}»`);
});
// La ruta manda el texto neutro, no el de escritura: no sabe qué se estaba
// haciendo, y el aviso que ve la persona lo pone quien sí lo sabe.
if (AVISO_NEUTRO === AVISO_ESCRITURA) mal('la ruta manda el aviso de escritura: no puede saber si se escribía');
if (fallos === antes5) bien('el {} termina en «no habló claro», y la ruta no elige el mensaje');

console.log(fallos ? `\nFALLA - ${fallos} problema(s)\n` : '\nTODO CUADRA\n');
process.exit(fallos ? 1 : 0);
