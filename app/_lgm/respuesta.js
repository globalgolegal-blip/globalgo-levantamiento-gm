// Cuándo una respuesta NO permite afirmar que la acción falló, y qué decirle a
// la persona según lo que se estaba haciendo.
//
// Las dos mitades del contrato están en un módulo compartido, y no una en la
// ruta y otra en el tablero, porque son dos caras de lo mismo y si se separan
// vuelve el error: la ruta dejaba pasar el `{}` de Apps Script tal cual, y el
// tablero leía la falta de `ok` como un rechazo y decía «No se pudo guardar»
// sobre una corrección que SÍ se había guardado en la hoja.
//
// Con corregir eso da igual. Con observar, la persona lo repite y quedan dos
// observaciones y una vuelta de más en el expediente.

/**
 * ¿La respuesta de Apps Script se puede interpretar?
 *
 * La usa app/api/lgm/route.js. Una respuesta sin `ok` no es una respuesta: es
 * `{}`, o algo que no sabemos leer. No significa que la acción no se ejecutara
 * —lo más probable, si contestó 200, es que sí—, significa que no sabemos.
 */
export const esRespuestaUsable = (data) =>
  !!data && typeof data === 'object' && typeof data.ok !== 'undefined';

/**
 * ¿El servidor dejó de hablar claro?
 *
 * - `indeterminado`: la ruta no pudo interpretar lo que contestó la hoja.
 * - `conexion`: no hubo respuesta, o se cayó el transporte.
 *
 * Cualquier otro `ok: false` sí es un rechazo: el servidor habló y dijo no, con
 * su motivo. A eso se le cree y se muestra su mensaje tal cual.
 *
 * El predicado es NEUTRO a propósito: solo dice que la respuesta no sirve, no
 * qué significa. Qué significa depende de lo que se estuviera haciendo, y eso
 * lo sabe quien llamó — de ahí los tres avisos de abajo en vez de uno.
 */
export const sinRespuestaClara = (r) =>
  !!r && (r.motivo === 'indeterminado' || r.motivo === 'conexion');

// ─────────────────────────────────────────────────────────────────────────────
// Tres avisos, porque «no se sabe» significa tres cosas distintas según lo que
// se estuviera haciendo. Un solo texto para las tres daba mensajes absurdos:
// «no sé si el cambio se guardó» cuando nadie estaba guardando nada.

/**
 * ESCRITURA. Es el único caso grave: la acción pudo haberse ejecutado y no se
 * puede repetir sin riesgo, porque repetirla graba el cambio dos veces.
 */
export const AVISO_ESCRITURA =
  'El servidor no confirmó el resultado, así que no sé si el cambio se guardó o no. '
  + 'Actualicé la lista: mira el expediente antes de repetir la acción, porque repetirla '
  + 'puede dejar el cambio hecho dos veces.';

/**
 * LECTURA. Leer sí es repetible sin riesgo, así que acá no hay nada que
 * advertir: se dice qué pasó y se ofrece reintentar. Y sobre todo, NO se cierra
 * la sesión — un `listar` ilegible caía en la rama del token y decía «Tu sesión
 * venció», que es falso y obliga a poner el PIN de nuevo por una falla ajena.
 */
export const AVISO_LECTURA =
  'No se pudo cargar la lista de expedientes. Tu sesión sigue abierta: vuelve a intentarlo.';

/**
 * INGRESO. Tampoco se sabe si el intento llegó a contarse, así que no se puede
 * afirmar que el PIN esté mal — decirlo sería acusar a la persona de un error
 * que quizá no cometió.
 */
export const AVISO_INGRESO =
  'No se pudo confirmar el ingreso. No es que el PIN esté mal: el servidor no respondió '
  + 'de forma que se pueda leer. Intenta de nuevo.';

/**
 * Lo que manda la ruta. Neutro, porque la ruta no sabe si quien llamó estaba
 * escribiendo o leyendo, y el aviso que ve la persona lo pone quien sí lo sabe.
 */
export const AVISO_NEUTRO = 'El servidor no confirmó el resultado.';
