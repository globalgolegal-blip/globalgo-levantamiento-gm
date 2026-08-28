import { NextResponse } from 'next/server';

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// El Apps Script a veces tarda en despertar y responde 404/5xx mientras arranca.
// Reintenta con espera creciente antes de darlo por caído de verdad.
async function llamarConReintentos(url, cuerpo) {
  const backoffs = [400, 1200];
  let ultimoError;

  for (let intento = 0; intento <= backoffs.length; intento++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(cuerpo),
        redirect: 'follow',
        cache: 'no-store',
      });
      if (r.status >= 500 || r.status === 404) {
        ultimoError = new Error('respondió ' + r.status);
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

/**
 * Puente entre el tablero y la hoja.
 *
 * El navegador nunca habla con Apps Script: ni la URL de la hoja ni el secreto
 * salen del servidor. El navegador solo conoce su token de sesión, que dura 12 horas
 * y no sirve para leer la hoja directamente.
 */
export async function POST(req) {
  const url = process.env.LGM_API_URL;
  const secreto = process.env.LGM_SECRETO;

  if (!url || !secreto) {
    return NextResponse.json(
      { ok: false, error: 'Faltan LGM_API_URL o LGM_SECRETO en el servidor' },
      { status: 500 }
    );
  }

  let cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Petición mal formada' }, { status: 400 });
  }

  try {
    const data = await llamarConReintentos(url, { ...cuerpo, secreto });

    // Acá había un revalidatePath('/') que no hacía nada: app/page.jsx es
    // force-dynamic y trae la hoja con cache: 'no-store', o sea que la ruta
    // nunca se guarda en la caché de rutas y no hay nada que invalidar. Se veía
    // como si los conteos se refrescaran solos después de cada cambio, y no era
    // así — parte de por qué el tablero iba una acción atrasado.
    //
    // Quien refresca de verdad es el cliente: trasAccion() vuelve a pedir el
    // listado (de donde salen los nueve contadores) y llama a router.refresh()
    // para la carga por área y las alertas. Si algún día page.jsx deja de ser
    // force-dynamic, acá hay que volver a invalidar.

    return NextResponse.json(data);
  } catch (e) {
    // Este mensaje es del transporte, nunca del PIN, del token o de los datos:
    // el servidor de Apps Script no respondió tras varios intentos. "motivo:
    // conexion" deja que el cliente lo distinga de un rechazo real de la hoja
    // (PIN incorrecto, token vencido) y no fuerce un cierre de sesión por esto.
    return NextResponse.json(
      { ok: false, motivo: 'conexion', error: 'El servicio no respondió tras varios intentos. Intenta de nuevo en un momento.' },
      { status: 502 }
    );
  }
}
