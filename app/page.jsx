import TableroLGM from './_lgm/TableroLGM';

export const metadata = {
  title: 'GoTrack · Levantamiento GM',
  description: 'Seguimiento del levantamiento de garantía mobiliaria',
};

// Sin caché: el tablero escribe, así que después de cada acción tiene que
// mostrar el estado real de la hoja, no una copia de hace un minuto.
export const dynamic = 'force-dynamic';

async function traerExpedientes() {
  const url = process.env.LGM_API_URL;
  const secreto = process.env.LGM_SECRETO;

  if (!url || !secreto) {
    return { error: 'Faltan LGM_API_URL o LGM_SECRETO', expedientes: [], usuarios: [], actualizado: null };
  }
  try {
    const r = await fetch(url + '?k=' + encodeURIComponent(secreto), { cache: 'no-store' });
    if (!r.ok) throw new Error('La hoja respondió ' + r.status);
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    return {
      expedientes: data.expedientes || [],
      usuarios: data.usuarios || [],
      actualizado: data.actualizado,
      error: null,
    };
  } catch (e) {
    return { error: e.message, expedientes: [], usuarios: [], actualizado: null };
  }
}

export default async function Page() {
  const { expedientes, usuarios, actualizado, error } = await traerExpedientes();
  return (
    <TableroLGM
      expedientes={expedientes}
      usuarios={usuarios}
      actualizado={actualizado}
      error={error}
    />
  );
}
