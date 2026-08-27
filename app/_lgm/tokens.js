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

// Lo que se lee en pantalla no siempre es el valor guardado: EN SUNARP se lee
// REGISTROS y CERRADO se lee FINALIZADO. El valor interno (columna "estado" de
// la hoja, COLOR_ESTADO, FONDO_ESTADO, ESTADOS_POR_ROL) no cambia — solo esto.
export const ETIQUETA_ESTADO = {
  'SOLICITADO':     'SOLICITADO',
  'OBS. TESORERÍA': 'OBS. TESORERÍA',
  'PAGO OK':        'PAGO OK',
  'EN TRÁMITE':     'TRÁMITE',
  'EN NOTARÍA':     'NOTARÍA',
  'EN SUNARP':      'REGISTROS',
  'OBS. LEGAL':     'OBS. LEGAL',
  'LEVANTADO':      'LEVANTADO',
  'CERRADO':        'FINALIZADO',
  'ANULADO':        'ANULADO',
};

// Tarjetas de conteo del tablero, en el orden en que avanza un expediente.
// Solo la clave y el color: la etiqueta sale siempre de ETIQUETA_ESTADO,
// arriba. Nada de texto escrito a mano acá — es la segunda lista de nombres
// la que hace que estas dos se separen apenas alguien renombra una sola.
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
