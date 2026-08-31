import { NextResponse } from 'next/server';
import { esRespuestaUsable, AVISO_NEUTRO } from '../../_lgm/respuesta';

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Se lanza cuando el servidor contestó pero no se entiende qué contestó. NO es
// lo mismo que no haber llegado: si Apps Script respondió 200 con el cuerpo
// vacío, es probable que la acción SÍ se haya ejecutado. Por eso tampoco se
// reintenta — repetir una mutación cuyo resultado no conocemos es cómo se
// terminan grabando dos observaciones y una vuelta de más en el expediente.
class RespuestaIndescifrable extends Error {}

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
        try {
          return await r.json();
        } catch {
          // Contestó, y con un estado que no invita a reintentar, pero el cuerpo
          // no es JSON. Se corta acá en vez de repetir la llamada.
          throw new RespuestaIndescifrable('cuerpo no interpretable con estado ' + r.status);
        }
      }
    } catch (e) {
      if (e instanceof RespuestaIndescifrable) throw e;
      ultimoError = e;
    }
    if (intento < backoffs.length) await espera(backoffs[intento]);
  }
  throw ultimoError;
}

// Lo que el cliente recibe cuando no se puede afirmar que la acción falló.
// `motivo: 'indeterminado'` es la señal: el cliente no debe decir que falló,
// tiene que decir que no se sabe y recargar el listado.
const indeterminado = () => NextResponse.json(
  { ok: false, motivo: 'indeterminado', error: AVISO_NEUTRO },
  { status: 502 }
);

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

    // Una respuesta sin `ok` no es una respuesta. Apps Script devolvió {} —pasó
    // de verdad, con una corrección que SÍ se guardó en la hoja— y el cliente
    // leía la falta de `ok` como un rechazo y decía «No se pudo guardar». Con
    // corregir da igual; con observar, la persona lo repite y quedan dos
    // observaciones. Acá se marca como indeterminado y el cliente lo dice así.
    if (!esRespuestaUsable(data)) return indeterminado();

    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof RespuestaIndescifrable) return indeterminado();
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
