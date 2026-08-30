// Los nueve números de las tarjetas del tablero, en un solo lugar.
//
// Tres reglas, y las tres salieron de errores que ya pasaron:
//
// 1. UN CONTADOR NO DEPENDE DE QUÉ TARJETA ESTÉ ELEGIDA. Antes se contaba
//    sobre `vivos`, que es la lista de la pantalla, y esa lista cambia con la
//    tarjeta elegida: al elegir Anulados, `vivos` se quedaba solo con los
//    anulados y los otros ocho contadores caían a 0. El mismo estado de la
//    hoja daba dos números distintos según dónde hubiera hecho clic la
//    persona. Los contadores se cuentan sobre TODOS los expedientes.
//
// 2. UNA SOLA FUENTE POR PINTADA. Los conteos del render del servidor y el
//    detalle de `listar` son dos llamadas con frescura distinta. Mezclarlas en
//    la misma fila de tarjetas hacía que unas fueran de hace un momento y
//    otras de hace un rato. Se usa el detalle cuando ya llegó, y los conteos
//    del servidor mientras no; nunca las dos a la vez, y nunca un 0 inventado
//    mientras el detalle viaja.
//
// 3. LOS CONTADORES SON GLOBALES. Un contador dice cuántos expedientes hay en
//    ese estado en toda la hoja, y punto. Cuando además filtraban por Vista, la
//    pantalla se contradecía sola: en Vista Cobranza, con un expediente en EN
//    NOTARÍA, el contador decía «En notaría: 0» y la ficha de ese expediente
//    estaba visible debajo al mismo tiempo, porque el buscador ignora los
//    filtros y el contador no. Filtrar es cosa del LISTADO; contar, no.
//
//    De paso desaparece un caso especial: ANULADO tenía que estar exento del
//    filtro de área para que Cobranza y Tesorería no vieran 0 para siempre. Sin
//    filtro de área en los contadores, no hay de qué eximirlo.

import { ESTADOS_POR_ROL, TARJETAS, normalizarEstado } from './tokens.js';

export const esAnulado = (e) => e.estado === 'ANULADO';

// Un expediente que todavía puede cambiar. CERRADO, LEVANTADO y ANULADO ya
// terminaron su recorrido.
export const esActivo = (e) => !['CERRADO', 'LEVANTADO', 'ANULADO'].includes(e.estado);

/**
 * Estado normalizado al entrar, una sola vez, en el borde de la aplicación.
 * Todo lo que compare `e.estado` después de esto compara valores internos.
 */
export const normalizarExpedientes = (lista) =>
  (lista || []).map((e) => ({ ...e, estado: normalizarEstado(e.estado) }));

/**
 * Los conteos del servidor vienen con las claves tal como están escritas en la
 * hoja. Se rearman con las claves internas. Se suma, no se sobreescribe: si la
 * hoja trajera "OBS. LEGAL" y "Obs. Legal " como dos claves, son el mismo
 * estado y sus expedientes tienen que sumarse, no perderse uno de los dos.
 */
export function normalizarConteos(conteos) {
  const out = {};
  Object.keys(conteos || {}).forEach((k) => {
    const clave = normalizarEstado(k);
    out[clave] = (out[clave] || 0) + (Number(conteos[k]) || 0);
  });
  return out;
}

/**
 * ¿Este estado entra en el LISTADO con la Vista puesta en `rol`?
 *
 * Solo para el listado: los contadores no filtran por Vista (regla 3 arriba).
 *
 * Ya no hace falta eximir a ANULADO: elegir un estado manda sobre la Vista
 * (ver porRolDe), y los anulados solo aparecen cuando se eligió su tarjeta.
 */
export const enLaVista = (estado, rol) =>
  rol === 'todos' || (ESTADOS_POR_ROL[rol] || []).includes(estado);

// Ver Anulados es elegir el estado ANULADO desde su tarjeta: mientras no esté
// elegido, los anulados no son parte de la lista. Esto es para LA LISTA de la
// pantalla — los contadores no pasan por acá, a propósito (regla 1 arriba).
export const vivosDe = (expedientes, estado) =>
  (expedientes || []).filter((e) => (estado === 'ANULADO' ? esAnulado(e) : !esAnulado(e)));

/**
 * Filtro de Vista del listado.
 *
 * Si la persona eligió un estado desde su tarjeta, esa elección manda sobre la
 * Vista: es una intención más específica, y así el listado concuerda con el
 * contador, que es global. No es un override silencioso — el encabezado del
 * listado dice «mostrando fuera de la Vista X» cuando pasa.
 */
export const porRolDe = (vivos, rol, estado = null) =>
  (rol === 'todos' || estado ? vivos : vivos.filter((e) => enLaVista(e.estado, rol)));

/**
 * Un número por tarjeta.
 *
 * `listado` dice si el detalle expediente por expediente ya llegó. Con detalle
 * se cuenta expediente por expediente; sin él se usan los totales por estado
 * del render del servidor. Nunca las dos fuentes en la misma pintada.
 *
 * No recibe la Vista ni la tarjeta elegida, a propósito: un contador cuenta lo
 * que hay en la hoja, no lo que quedó después de filtrar la pantalla. Los dos
 * filtros viven en el listado, que es donde una persona los puso.
 */
export function contadores({ expedientes = [], conteos = {}, listado = false }) {
  const out = {};

  TARJETAS.forEach(([clave]) => {
    out[clave] = listado
      ? (expedientes || []).filter((e) => e.estado === clave).length
      : (conteos[clave] || 0);
  });

  return out;
}
