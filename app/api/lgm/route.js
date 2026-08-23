import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

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
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...cuerpo, secreto }),
      redirect: 'follow',
      cache: 'no-store',
    });
    const data = await r.json();

    // Si algo cambió en la hoja, el tablero tiene que dejar de mostrar lo viejo.
    if (data.ok && cuerpo.accion !== 'entrar') revalidatePath('/');

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'No se pudo escribir en la hoja: ' + e.message },
      { status: 502 }
    );
  }
}
