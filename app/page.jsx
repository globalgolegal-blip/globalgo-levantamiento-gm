import TableroLGM from './_lgm/TableroLGM';

export const metadata = {
  title: 'GoTrack · Levantamiento GM',
  description: 'Seguimiento del levantamiento de garantía mobiliaria',
};

// Sin caché: el tablero escribe, así que después de cada acción tiene que
// mostrar el estado real de la hoja, no una copia de hace un minuto.
export const dynamic = 'force-dynamic';

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// El Apps Script a veces tarda en despertar y responde 404/5xx mientras arranca.
// Reintenta con espera creciente antes de darlo por caído de verdad.
async function traerConReintentos(url) {
  const backoffs = [400, 1200];
  let ultimoError;

  for (let intento = 0; intento <= backoffs.length; intento++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.status >= 500 || r.status === 404) {
        ultimoError = new Error('respondió ' + r.status);
      } else if (!r.ok) {
        throw new Error('respondió ' + r.status);
      } else {
        return await r.json();
      }
    } catch (e) {
      ultimoError = e;
    }
    if (intento < backoffs.length) await espera(backoffs[intento]);
  }
  throw ultimoError;
}

// Sin sesión, la hoja solo manda conteos y colores — nunca nombres, DOI ni
// montos de cliente. El detalle completo se pide aparte, ya identificado,
// con la acción "listar" (ver app/_lgm/TableroLGM.jsx).
const VACIO = { conteos: {}, carga: {}, alertas: 0, usuarios: [], actualizado: null, error: null };

async function traerResumen() {
  const url = process.env.LGM_API_URL;
  const secreto = process.env.LGM_SECRETO;

  if (!url || !secreto) {
    return { ...VACIO, error: 'Faltan LGM_API_URL o LGM_SECRETO' };
  }
  try {
    const data = await traerConReintentos(url + '?k=' + encodeURIComponent(secreto));
    if (data.error) throw new Error(data.error);
    return {
      conteos: data.conteos || {},
      carga: data.carga || {},
      alertas: data.alertas || 0,
      usuarios: data.usuarios || [],
      actualizado: data.actualizado,
      error: null,
    };
  } catch (e) {
    // Tras varios intentos, lo más probable es que el servicio no esté
    // respondiendo — no necesariamente que LGM_API_URL o LGM_SECRETO estén mal.
    return { ...VACIO, error: 'El servicio no respondió tras varios intentos (' + e.message + ')' };
  }
}

export default async function Page() {
  const { conteos, carga, alertas, usuarios, actualizado, error } = await traerResumen();
  return (
    <TableroLGM
      conteos={conteos}
      carga={carga}
      alertas={alertas}
      usuarios={usuarios}
      actualizado={actualizado}
      error={error}
    />
  );
}
