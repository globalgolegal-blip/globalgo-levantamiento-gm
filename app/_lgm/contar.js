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

import { TARJETAS, normalizarEstado, claveArea } from './tokens.js';

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

// Ver Anulados es elegir el estado ANULADO desde su tarjeta: mientras no esté
// elegido, los anulados no son parte de la lista. Esto es para LA LISTA de la
// pantalla — los contadores no pasan por acá, a propósito (regla 1 arriba).
export const vivosDe = (expedientes, estado) =>
  (expedientes || []).filter((e) => (estado === 'ANULADO' ? esAnulado(e) : !esAnulado(e)));

/**
 * Los tres grupos del listado. UNA sola lista, con todo; los grupos son orden,
 * no filtro. Ningún expediente puede quedar fuera de los tres.
 *
 * Esto reemplaza al filtro por Vista, y la diferencia no es cosmética. El filtro
 * por área escondía expedientes: LGM-2026-0007 estaba en PAGO OK y le tocaba a
 * Legal, así que no le aparecía a Cobranza — y Cobranza es justamente quien
 * tiene que observarlo cuando el cliente desiste. Un filtro automático por área
 * volvería el desistimiento imposible de pedir, sin que nadie se enterara hasta
 * que un cliente reclamara.
 *
 * `responsable` es texto para mostrar, no una clave: trae «Tesorería», «Notaría
 * Quintanilla», «SUNARP» o «—». Se normaliza con claveArea antes de comparar.
 * «Notaría Quintanilla» y «SUNARP» no son áreas del tablero y no coinciden con
 * ninguna sesión: caen en `resto`, no desaparecen.
 *
 * Y `responsable` no se guarda: es una fórmula de la hoja que busca el estado en
 * una tabla. Si el rango de búsqueda se queda corto —ya pasó con un estado
 * nuevo— devuelve CADENA VACÍA sin dar un solo error. Un expediente así está
 * atascado y nadie lo va a mirar, así que va a `anomalias`, que se pinta arriba
 * y marcada. Esconderlo es exactamente el error que no queremos repetir.
 */
export function agrupar(lista, area) {
  const anomalias = [];
  const teToca = [];
  const resto = [];

  (lista || []).forEach((e) => {
    const responsable = claveArea(e.responsable);
    // Vacío es la anomalía. «—» NO lo es: es el responsable legítimo de un
    // expediente que ya terminó, y significa «nadie, y está bien».
    if (!responsable) anomalias.push(e);
    else if (area && responsable === area) teToca.push(e);
    else resto.push(e);
  });

  return { anomalias, teToca, resto };
}

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
