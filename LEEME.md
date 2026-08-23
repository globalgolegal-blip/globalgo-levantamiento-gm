# Levantamiento GM · web

Lee y escribe en la hoja de Google a través de la aplicación web de Apps Script.

## Qué es

Una web propia, independiente de GoTrack. GoTrack solo necesita un botón que enlace acá.
Así no hace falta tocar el repositorio de GoTrack para desplegar ni para actualizar.

```
app/page.jsx            La página. Trae los expedientes de la hoja.
app/layout.jsx          Envoltura mínima.
app/_lgm/TableroLGM.jsx Tablero, filtros, fichas, identificación y acciones.
app/_lgm/tokens.js      Paleta de GoTrack, motivos y permisos de vista.
app/api/lgm/route.js    Puente al Apps Script. Es lo único que conoce el secreto.
package.json            Next.js 14.
.env.example            Las variables, con la URL del Apps Script ya puesta.
```

JSX sin anotaciones de tipo. Si prefieres TypeScript, renombra a `.tsx` / `.ts` y compila igual.

## Instalación

1. Crea un repositorio nuevo con estos archivos y conéctalo a Vercel.

2. En Vercel, variables de entorno (copia de `.env.example`):

   ```
   LGM_API_URL       la URL del Apps Script que termina en /exec
   LGM_SECRETO       el mismo valor de la propiedad LGM_SECRETO del script
   NEXT_PUBLIC_GOTRACK_URL          https://gotrack-go.vercel.app
   NEXT_PUBLIC_LGM_FORM_COBRANZA    enlace del formulario de registro
   NEXT_PUBLIC_LGM_FORM_CIERRE      enlace del formulario de cierre
   NEXT_PUBLIC_LGM_FORM_COMPROBANTE enlace del formulario de comprobante
   ```

   `LGM_API_URL` y `LGM_SECRETO` van **sin** el prefijo `NEXT_PUBLIC_`, a propósito:
   así se quedan en el servidor y no viajan al navegador.

3. Despliega. Queda en la raíz de tu propio dominio de Vercel.

4. En GoTrack, agrega el botón que enlaza acá. Es lo único que se toca de ese repositorio:

   ```jsx
   <a href="https://TU-PROYECTO.vercel.app">Levantamiento GM</a>
   ```

## Usuarios

Cada persona tiene su propia fila en la hoja **Usuarios**: nombre corto, nombre completo,
área, PIN, si está activa, correo y foto. No hay límite de personas por área.

Para entrar: se elige el área, se toca la foto de la persona y se escribe su PIN. La
bitácora guarda ese usuario en cada cambio, así siempre se sabe quién hizo qué.

- **La foto es opcional.** Sube las fotos a una carpeta de Drive visible para cualquiera con
  el enlace y pega la dirección con el formato
  `https://drive.google.com/thumbnail?id=ID_DEL_ARCHIVO&sz=w160`. Si no hay foto, el tablero
  muestra las iniciales en un círculo.
- **Dar de baja a alguien**: pon `activo` en `NO`. Deja de poder entrar y su historial se
  conserva intacto. Nunca borres la fila.
- **La duración de la sesión** se configura en Catalogos, celda B9. Por defecto son 12 horas,
  suficiente para una jornada. No limita cuántas personas trabajan a la vez ni cuántos
  expedientes se procesan: solo dice cada cuánto hay que volver a poner el PIN.
- **El PIN nunca sale de la hoja.** El navegador guarda solo un token de sesión, y la lista
  de usuarios que llega al tablero no incluye los PIN.
- Quien pueda abrir la hoja ve los PIN. Restringe la edición del archivo al responsable del
  sistema y comparte el tablero, no la hoja.

## Quién puede hacer qué

| Acción | Área | Desde qué estado |
|---|---|---|
| Validar pago | Tesorería | SOLICITADO |
| Observar | Tesorería o Legal | los estados que le tocan a su área |
| Responder la observación | Cobranza | OBS. TESORERÍA · OBS. LEGAL |
| Reemplazar comprobante | Cobranza | solo si está observado |
| Levantar en SIGM | Legal | PAGO OK, Ruta A |
| Registrar ingreso a notaría | Legal | PAGO OK · EN TRÁMITE, Ruta B |
| Registrar N° de título | Legal | EN NOTARÍA |
| Cargar boleta y cerrar | Legal | EN TRÁMITE · EN SUNARP |
| Anular | Legal | cualquiera menos CERRADO |

En la ficha se ve además **quién registró la solicitud**, con su foto.

El servidor de Apps Script vuelve a comprobar el área y el estado en cada llamada.
Ocultar un botón en el navegador no es una restricción; la restricción está en el servidor.

## Decisiones de diseño

- **Los archivos siguen en formularios de Google.** Registrar la solicitud, cargar la boleta
  y reemplazar el comprobante son los tres pasos que suben un archivo, y se quedaron en
  formulario. Todo lo demás se opera desde el tablero.

- **El comprobante solo se cambia mientras el expediente está observado.** Fuera de ese
  momento no se toca: es la prueba de lo que revisó Tesorería cuando validó.

- **Anular no borra.** El expediente pasa a `ANULADO` con motivo obligatorio y sale del
  tablero salvo que filtres «Anulados». La fila se queda en la hoja con su ID y su historial.
  Un expediente ya cerrado no se puede anular. Al cliente se le avisa solo si Legal marca
  la casilla, porque una solicitud de prueba no merece un correo.

- **El secreto no llega al navegador.** El tablero habla con `/api/lgm`, que corre en el
  servidor de Vercel; solo ese código conoce la URL de la hoja y el secreto. El navegador
  guarda únicamente un token de sesión que caduca en 12 horas. Vale la pena notarlo porque
  el módulo de Desembolso sí llama a Apps Script directo desde el navegador, y ahí la URL
  queda expuesta: cualquiera que la copie puede leer los datos de todos los clientes.

- **Las reglas viven en la hoja.** Régimen, monto, plazos, semáforo y alerta de notaría son
  fórmulas. Si cambia una tarifa se edita Catalogos y esta ruta no se toca.

- **Sin verde.** Rojo para vencido, naranja para observado, azul para en plazo, navy para
  cerrado, gris para anulado y para el tiempo en registro público.

## Qué falta para la Fase 2

Que el cliente inicie su propia solicitud exige base de datos y formulario propios:
Google Forms obliga a iniciar sesión con cuenta Google para subir la foto del voucher.
También hace falta identificar al cliente con un código de un solo uso, porque el DOI y
el N° de crédito no bastan para entregarle un documento con sus datos personales.
