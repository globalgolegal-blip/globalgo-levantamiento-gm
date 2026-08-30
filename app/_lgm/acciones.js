// Qué botones se le ofrecen a un área sobre un expediente.
//
// Esto NO es la tabla de permisos del servidor y no pretende serlo: el servidor
// vuelve a comprobar área y estado en cada llamada, y cuando rechaza, su
// mensaje se muestra tal cual. Acá solo se decide qué se ofrece, para que la
// pantalla no proponga cosas imposibles.
//
// Está en su propio módulo, y no dentro del JSX, por la misma razón que los
// contadores: son 3 áreas × 10 estados, y una casilla mal puesta significa que
// alguien no puede hacer su trabajo. Así se puede imprimir la tabla completa y
// mirarla, en vez de razonarla botón por botón.

import { OBSERVADOS, claveArea } from './tokens.js';
import { esActivo } from './contar.js';

/** El expediente está observado y es esta área la que tiene que resolverlo. */
export const meToca = (e, area) =>
  OBSERVADOS.includes(e.estado) && claveArea(e.responsable) === area;

/**
 * La línea es el dinero: Tesorería ya validó el pago.
 *
 * Se lee de la fecha y no de una lista de estados porque OBS. TESORERÍA puede
 * ocurrir después de validar, y ahí solo la fecha dice la verdad. El servidor
 * usa el mismo criterio desde la v13.
 */
export const trasElPago = (e) => !!e.fechaValidacion;

/**
 * Corregir los datos del cliente, y responder la observación.
 *
 * Las dos son de quien tiene el expediente en el escritorio, y eso lo dice la
 * columna responsable de la hoja — no una lista de áreas escrita acá. Con
 * OBS. COBRANZA el responsable es Legal, así que el mismo criterio sirve para
 * las tres observaciones sin un caso aparte.
 */
export const puedeCorregir = meToca;
export const puedeResponder = meToca;

/** El comprobante es el documento de Cobranza, y solo mientras es suyo. */
export const puedeReemplazarComprobante = (e, area) =>
  area === 'cobranza' && meToca(e, area);

/**
 * Anular.
 *
 * Legal, en cualquier expediente vivo. Cobranza, mientras el pedido siga
 * siendo suyo: antes de que el pago se valide. Validado el pago, anular es
 * devolverle plata al cliente y eso lo decide Legal — ahí Cobranza observa.
 *
 * El «nunca desde FINALIZADO» no hace falta escribirlo: esActivo ya excluye
 * CERRADO, LEVANTADO y ANULADO. La garantía ya se levantó y el cliente ya tiene
 * su boleta; eso ocurrió en el mundo y no se deshace con un clic.
 */
export const puedeAnular = (e, area) => esActivo(e) && (
  area === 'legal' ||
  (area === 'cobranza' && !trasElPago(e) && ['SOLICITADO', 'OBS. TESORERÍA'].includes(e.estado))
);

/**
 * Observar.
 *
 * Tesorería observa lo que tiene en su escritorio, antes del pago: es como
 * rechaza un depósito que no cuadra, y es la observación más frecuente de todo
 * el sistema. Su rama sale por su propia línea y NO pasa por trasElPago, que
 * en SOLICITADO sería falso por definición — sin esto, un depósito equivocado
 * no tendría forma de volver a Cobranza. La regla 7 de
 * scripts/verificar-acciones.mjs lo fija para que no se apague en silencio.
 *
 * Legal y Cobranza observan en el tramo posterior al pago — Legal porque los
 * datos no cuadran con la partida, Cobranza porque el cliente desistió.
 *
 * DECISIÓN, no efecto colateral: Legal no puede observar un SOLICITADO, aunque
 * el servidor sí lo permita (PERMISO.observar.desde lo incluye). Un expediente
 * que todavía está en manos de Tesorería no es de Legal, y ofrecerlo invita a
 * pisar el trabajo de otra área. Si algún día hace falta, se quita de acá.
 *
 * Un expediente ya observado no se vuelve a observar: está esperando a alguien,
 * y una segunda observación no le dice nada a nadie. Es además lo que impide
 * que Cobranza observe la OBS. COBRANZA que ella misma abrió.
 */
export function puedeObservar(e, area) {
  if (!esActivo(e) || OBSERVADOS.includes(e.estado)) return false;
  if (area === 'tesoreria') return e.estado === 'SOLICITADO';
  return trasElPago(e) && (area === 'legal' || area === 'cobranza');
}

/** A quién le llega la observación que estoy escribiendo. */
export const destinoObservacion = (area) => (area === 'cobranza' ? 'Legal' : 'Cobranza');
