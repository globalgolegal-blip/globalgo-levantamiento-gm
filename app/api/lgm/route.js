import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

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

    // Si algo cambió en la hoja, el tablero tiene que dejar de mostrar lo viejo.
    // "listar" es una lectura: no cambia nada, no vale la pena invalidar por eso.
    if (data.ok && cuerpo.accion !== 'entrar' && cuerpo.accion !== 'listar') revalidatePath('/');

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
