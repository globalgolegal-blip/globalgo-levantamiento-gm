// Paleta y medidas de GoTrack, tomadas del CSS de producción.
// Si algún día cambian los colores del sistema, se cambian acá y no en los componentes.

// El servidor exige el mismo mínimo en cuatro comparaciones (TEXTO_MINIMO).
// Si este número y ese se separan, el panel deja confirmar y el servidor
// rechaza — un botón que se activa y falla, peor que uno que no se activa.
export const MIN_TEXTO = 5;

export const T = {
  navy: '#1A2238',
  crema: '#F1EFE8',
  blanco: '#FFFFFF',
  linea: '#D3D1C7',
  linea2: '#B4B2A9',
  texto: '#444441',
  texto2: '#5F5E5A',
  texto3: '#888780',
  azul: '#185FA5',
  azulBg: '#E6F1FB',
  azulNav: '#9BB4D8',
  naranja: '#FF6600',
  naranjaTx: '#CC5500',
  naranjaBg: '#FFF0E6',
  ambar: '#BA7517',
  ambarBg: '#FBF0DF',
  rojo: '#A32D2D',
  rojoBg: '#FCEBEB',
  rojoLinea: '#F09595',
  neutroBg: '#EDEBE3',
  rCard: 12,
  rPill: 20,
  rInput: 10,
  borde: '0.5px solid #D3D1C7',
};

// Un color por estado. Sin verde, por decisión del equipo:
// el color se reserva para lo que necesita atención.
export const COLOR_ESTADO = {
  'SOLICITADO':     T.azul,
  'OBS. TESORERÍA': T.naranja,
  'PAGO OK':        T.azul,
  'EN TRÁMITE':     T.azul,
  'EN NOTARÍA':     T.azul,
  'EN SUNARP':      T.linea2,
  'OBS. LEGAL':     T.naranja,
  'LEVANTADO':      T.navy,
  'CERRADO':        T.navy,
  'ANULADO':        T.linea2,
};

export const FONDO_ESTADO = {
  'SOLICITADO':     [T.azulBg, T.azul],
  'OBS. TESORERÍA': [T.naranjaBg, T.naranjaTx],
  'PAGO OK':        [T.azulBg, T.azul],
  'EN TRÁMITE':     [T.azulBg, T.azul],
  'EN NOTARÍA':     [T.azulBg, T.azul],
  'EN SUNARP':      [T.neutroBg, T.texto2],
  'OBS. LEGAL':     [T.naranjaBg, T.naranjaTx],
  'LEVANTADO':      [T.neutroBg, T.navy],
  'CERRADO':        [T.neutroBg, T.navy],
  'ANULADO':        [T.neutroBg, T.texto3],
};

// Dos vocabularios, no uno — de ahí la sobrecorrección anterior:
// - insignia: nombra el ESTADO de un expediente (la pastilla de la ficha).
//   TRÁMITE, NOTARÍA, REGISTROS, FINALIZADO.
// - contador: nombra una CANTIDAD de expedientes (tarjetas y filtros).
//   Plural, minúscula, y el "En" sí corresponde acá: "3 en trámite".
// Una sola fila por estado para que las dos formas no puedan desincronizarse.
export const ESTADO = {
  'SOLICITADO':     { insignia: 'SOLICITADO',     contador: 'Solicitados' },
  'OBS. TESORERÍA': { insignia: 'OBS. TESORERÍA', contador: 'Obs. Tesorería' },
  'PAGO OK':        { insignia: 'PAGO OK',        contador: 'Pago validado' },
  'EN TRÁMITE':     { insignia: 'TRÁMITE',        contador: 'En trámite' },
  'EN NOTARÍA':     { insignia: 'NOTARÍA',        contador: 'En notaría' },
  'EN SUNARP':      { insignia: 'REGISTROS',      contador: 'En registros' },
  'OBS. LEGAL':     { insignia: 'OBS. LEGAL',     contador: 'Obs. Legal' },
  'CERRADO':        { insignia: 'FINALIZADO',     contador: 'Finalizados' },
  'ANULADO':        { insignia: 'ANULADO',        contador: 'Anulados' },
};

// ─────────────────────────────────────────────────────────────────────────────
// El estado llega como el texto de una celda, y una celda admite variantes que
// para una persona son el mismo estado y para `===` no: un espacio de más, un
// espacio duro que entró al pegar, el acento descompuesto, o minúsculas.
//
// El servidor ya contaba con trim() y el tablero comparaba en crudo. De ahí el
// error de los dos contadores: la hoja decía 1, la tarjeta decía 0, y no era
// que se quedara vieja — no había forma de que se arreglara sola. Acá el texto
// se lleva al valor interno UNA sola vez, al entrar, y de ahí en adelante todo
// el tablero compara valores internos contra valores internos.
//
// COLOR_ESTADO es la única tabla que tiene los diez estados (los nueve con
// tarjeta más LEVANTADO): se usa como lista canónica para no escribir una
// décima lista de nombres a mano.
const CANONICOS = Object.keys(COLOR_ESTADO);

// Solo letras y números, sin acentos. Absorbe de una vez el punto de
// "OBS. LEGAL", el acento de "OBS. TESORERÍA" y cualquier espacio raro. Los
// diez estados siguen siendo distintos así reducidos —lo comprueba
// scripts/verificar-contadores.mjs—, o sea que esto no puede fundir dos.
const esqueleto = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');

const POR_ESQUELETO = new Map(CANONICOS.map((k) => [esqueleto(k), k]));

/**
 * Texto de la celda -> valor interno del estado.
 *
 * Si no reconoce el valor devuelve el texto recortado, nunca vacío: un estado
 * que nadie previó tiene que verse en pantalla, no desaparecer del tablero.
 */
export function normalizarEstado(v) {
  const limpio = String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  return POR_ESQUELETO.get(esqueleto(limpio)) || limpio;
}

// Tarjetas de conteo del tablero, en el orden en que avanza un expediente.
// Solo la clave y el color: la etiqueta sale siempre de ESTADO[clave].contador,
// arriba. Nada de texto escrito a mano acá.
export const TARJETAS = [
  ['SOLICITADO',     T.azul],
  ['OBS. TESORERÍA', T.naranja],
  ['PAGO OK',        T.azul],
  ['EN TRÁMITE',     T.azul],
  ['EN NOTARÍA',     T.azul],
  ['EN SUNARP',      T.linea2],
  ['OBS. LEGAL',     T.naranja],
  ['CERRADO',        T.navy],
  // Última, en gris apagado: un anulado no es trabajo pendiente y no debe
  // pedir atención visual, pero tiene que ser encontrable, no invisible.
  ['ANULADO',        T.linea2],
];

// Qué estados ve cada área.
export const ESTADOS_POR_ROL = {
  cobranza:  ['SOLICITADO', 'OBS. TESORERÍA', 'OBS. LEGAL', 'LEVANTADO', 'CERRADO'],
  tesoreria: ['SOLICITADO', 'OBS. TESORERÍA', 'PAGO OK', 'CERRADO'],
  legal:     ['PAGO OK', 'EN TRÁMITE', 'EN NOTARÍA', 'EN SUNARP', 'OBS. LEGAL', 'LEVANTADO', 'CERRADO', 'ANULADO'],
};

// Motivos de observación. Reemplázalos por los que el equipo ve de verdad.
export const MOTIVOS = {
  tesoreria: [
    'Monto depositado incorrecto',
    'Voucher ilegible',
    'Depósito no encontrado en el extracto',
    'Fecha del depósito no coincide',
    'Comprobante duplicado',
    'Otro',
  ],
  legal: [
    'N° de crédito no coincide con la partida registral',
    'DOI errado',
    'La garantía ya fue levantada',
    'Datos del cliente incompletos',
    'Placa no corresponde al crédito',
    'Otro',
  ],
};

// Anular no borra: mueve el expediente a ANULADO y lo saca del tablero.
export const MOTIVOS_ANULAR = [
  'Solicitud de prueba',
  'Duplicada',
  'Datos errados irrecuperables',
  'El cliente desistió',
  'Otro',
];
