// Paleta y medidas de GoTrack, tomadas del CSS de producción.
// Si algún día cambian los colores del sistema, se cambian acá y no en los componentes.

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

// Tarjetas de conteo del tablero, en el orden en que avanza un expediente.
export const TARJETAS = [
  ['SOLICITADO',     'Solicitados',    T.azul],
  ['OBS. TESORERÍA', 'Obs. Tesorería', T.naranja],
  ['PAGO OK',        'Pago validado',  T.azul],
  ['EN TRÁMITE',     'En trámite',     T.azul],
  ['EN NOTARÍA',     'En notaría',     T.azul],
  ['EN SUNARP',      'En SUNARP',      T.linea2],
  ['OBS. LEGAL',     'Obs. Legal',     T.naranja],
  ['CERRADO',        'Cerrados',       T.navy],
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
