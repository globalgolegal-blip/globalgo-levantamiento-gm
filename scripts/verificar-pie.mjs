// Comprueba el pie de página contra el texto que se especificó, carácter por
// carácter. Son datos de registro ante la ANPD y una línea en quechua: un
// dígito o una tilde de más no se ven mirando la pantalla, y acá no se pueden
// «arreglar» sin que esto falle.
//
//   npm run verificar-pie
//
// Lee el JSX como texto, a propósito: no renderiza. Así comprueba lo que está
// escrito en el archivo, que es donde alguien lo va a cambiar por descuido.

import { readFileSync } from 'node:fs';

const fuente = readFileSync('app/_lgm/Pie.jsx', 'utf8');

let fallos = 0;
const mal = (m) => { fallos++; console.log('  x  ' + m); };
const bien = (m) => console.log('  ok ' + m);

// Colapsa el salto de línea y la sangría del JSX, para comparar el texto que
// se lee y no cómo quedó envuelto en el archivo.
const plano = fuente.replace(/\s+/g, ' ');
const contiene = (txt) => plano.includes(txt.replace(/\s+/g, ' '));

/* -- 1. las tres líneas de cabecera --------------------------------------- */

console.log('\n1. Las tres líneas de cabecera');
const antes1 = fallos;
[
  'POWERED BY LEGAL TEAM GO',
  'IMPULSADO POR EL EQUIPO LEGAL DE GO',
  'GO EQUIPO LEGAL IMAYNA RUWASQAN',
].forEach((linea) => {
  if (!contiene(linea)) mal(`falta o está cambiada: «${linea}»`);
});

// La tercera es quechua y va exactamente así: sin tildes y sin reordenar. Se
// comprueba código por código, porque «Imayna» o «RUWASQAÑ» pasarían por buenos
// a la vista y no lo son.
const QUECHUA = 'GO EQUIPO LEGAL IMAYNA RUWASQAN';
const enElArchivo = (plano.match(/GO EQUIPO LEGAL [^<]*?(?=<)/) || [''])[0].trim();
if (enElArchivo !== QUECHUA) {
  mal(`la línea en quechua dice «${enElArchivo}» y debe decir «${QUECHUA}»`);
} else if ([...enElArchivo].some((c) => c.charCodeAt(0) > 122)) {
  mal('la línea en quechua tiene un carácter con tilde o diacrítico');
} else if (fallos === antes1) {
  bien('las tres líneas, y la de quechua exacta: sin tildes y sin reordenar');
}

/* -- 2. los bancos de datos personales ------------------------------------ */

console.log('\n2. Bancos de datos personales · ANPD · Ley 29733');
const antes2 = fallos;
if (!contiene('Bancos de datos personales · ANPD · Ley 29733')) {
  mal('falta el título del bloque');
}

const ENTIDADES = [
  {
    entidad: 'Global Go S.A.C.',
    codigo: 'PJ-2026-2079',
    constancia: 'INS-2026-2295',
    ruc: '20611596155',
  },
  {
    entidad: 'Coop. de Ahorro y Crédito Promotora de Negocios y Servicios',
    codigo: 'PJ-2026-2095',
    constancia: 'INS-2026-2312',
    ruc: '20523897048',
  },
];

ENTIDADES.forEach(({ entidad, codigo, constancia, ruc }) => {
  if (!contiene(entidad)) mal(`falta la entidad «${entidad}»`);
  [codigo, constancia, ruc].forEach((c) => {
    if (!contiene(`'${c}'`)) mal(`falta el código ${c} de ${entidad}`);
  });
  // Once dígitos. Con diez o con doce está mal copiado.
  if (!/^\d{11}$/.test(ruc)) mal(`el RUC esperado ${ruc} no tiene once dígitos`);
});

// Y que en el archivo no haya un RUC de largo distinto: si alguien corrige un
// dígito y se le va uno, esto lo caza aunque el número siga «pareciendo» RUC.
[...fuente.matchAll(/ruc:\s*'(\d+)'/g)].forEach(([, n]) => {
  if (n.length !== 11) mal(`hay un RUC en el archivo con ${n.length} dígitos: ${n}`);
});
if (fallos === antes2) bien('las dos entidades, sus códigos y sus dos RUC de once dígitos');

/* -- 3. el aviso de confidencialidad -------------------------------------- */

console.log('\n3. El aviso de confidencialidad');
const AVISO = 'La información contenida en esta plataforma es de carácter confidencial y de uso '
  + 'exclusivo del personal autorizado de Global Go S.A.C. y de la Cooperativa de Ahorro y '
  + 'Crédito Promotora de Negocios y Servicios. Su acceso, reproducción o divulgación no '
  + 'autorizada está prohibida.';
if (!contiene(AVISO)) mal('el aviso de confidencialidad no coincide palabra por palabra');
else bien('el aviso está completo y sin cambios');

/* -- 4. el cierre y el enlace --------------------------------------------- */

console.log('\n4. El cierre');
[
  '© 2026 Global Go S.A.C. · Todos los derechos reservados',
  'Desarrollado por Fernando Barzola y Juan Carlos Barrientos',
  'Desarrollado con asistencia de Claude',
  'Anthropic',
].forEach((linea) => {
  if (!contiene(linea)) mal(`falta o está cambiada: «${linea}»`);
});

const antes4 = fallos;

// claude.ai enlaza fuera, y las tres cosas van juntas: sin rel, target="_blank"
// deja a la página abierta al window.opener del destino.
const bloqueEnlace = plano.slice(plano.indexOf('href="https://claude.ai"'), plano.indexOf('claude.ai</a>'));
['href="https://claude.ai"', 'target="_blank"', 'rel="noopener noreferrer"'].forEach((attr) => {
  if (!bloqueEnlace.includes(attr)) mal(`al enlace de claude.ai le falta ${attr}`);
});
if (!contiene('claude.ai</a>')) mal('el texto visible del enlace no es claude.ai');
if (fallos === antes4) bien('las cuatro líneas del cierre, y claude.ai con target y rel');

/* -- 5. se ve siempre ------------------------------------------------------ */

console.log('\n5. El pie no depende de la sesión');
const tablero = readFileSync('app/_lgm/TableroLGM.jsx', 'utf8');
if (!tablero.includes('<Pie />')) {
  mal('el tablero no monta el pie');
} else {
  // Tiene que estar fuera de <main> y sin ninguna condición delante.
  const linea = tablero.split('\n').find((l) => l.includes('<Pie />'));
  if (!/^\s*<Pie \/>\s*$/.test(linea)) {
    mal(`el pie está condicionado: «${linea.trim()}»`);
  } else if (tablero.indexOf('<Pie />') < tablero.indexOf('</main>')) {
    mal('el pie está dentro de <main>, no al final de la página');
  } else {
    bien('se monta al final, fuera de <main> y sin condición de sesión');
  }
}

console.log(fallos ? `\nFALLA - ${fallos} problema(s)\n` : '\nTODO CUADRA\n');
process.exit(fallos ? 1 : 0);
