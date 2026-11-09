'use client';

import { useEffect, useRef, useState } from 'react';
import { T } from './tokens';
import { sinRespuestaClara, AVISO_ESCRITURA } from './respuesta';

// Registrar una solicitud desde el tablero (reemplaza al formulario 1).
//
// Primero la placa: el servidor dice si está en la lista de tachados. Si está,
// es NUEVA y no se pide la fecha. Si no, se pide la fecha de firma de la GM y
// el monto sale de la fecha de corte de Catalogos. La lista nunca llega acá:
// solo «está / no está», el régimen y el monto.

const MAX_VOUCHER = 3 * 1024 * 1024; // el puente de Vercel acepta ~4,5 MB por petición
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const normPlaca = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const soles = (n) => 'S/ ' + Number(n || 0).toFixed(2);
const LEY = { NUEVA: 'NUEVA · DL 1400', ANTIGUA: 'ANTIGUA · Ley 28677' };

const entrada = {
  width: '100%', border: `0.5px solid ${T.linea2}`, background: T.blanco, color: T.texto,
  borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box',
};

function Campo({ etiqueta, ayuda, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.texto }}>{etiqueta}</span>
      {children}
      {ayuda && <span style={{ fontSize: 11, color: T.texto3 }}>{ayuda}</span>}
    </label>
  );
}

function Btn({ children, onClick, primario, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      border: `0.5px solid ${primario ? T.navy : T.linea2}`,
      background: primario ? T.navy : T.blanco, color: primario ? T.blanco : T.texto,
      borderRadius: T.rInput, padding: '8px 14px', fontSize: 13, fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    }}>{children}</button>
  );
}

function Caja({ fondo, color, children }) {
  return (
    <div style={{
      background: fondo, border: `0.5px solid ${color}`, borderLeft: `4px solid ${color}`,
      borderRadius: T.rCard, padding: '10px 12px', margin: '4px 0 12px', fontSize: 13, color: T.texto,
    }}>{children}</div>
  );
}

/** Lee el archivo como base64. Las fotos grandes se reducen a JPEG 1600 px. */
async function leerArchivo(file) {
  let blob = file;
  if (file.type.startsWith('image/') && file.size > 1.2 * 1024 * 1024) {
    try {
      const img = await createImageBitmap(file);
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
    } catch { blob = file; }
  }
  const base64 = await new Promise((ok, mal) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1] || '');
    fr.onerror = mal;
    fr.readAsDataURL(blob);
  });
  return { nombre: file.name, tipo: blob.type || file.type, tam: blob.size, base64 };
}

export default function RegistroSolicitud({ sesion, llamar, onCerrar, onListo, onDudoso, formAnterior }) {
  const [placa, setPlaca] = useState('');
  const [consulta, setConsulta] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [fecha, setFecha] = useState('');
  const [d, setD] = useState({ doi: '', nombre: '', credito: '', correo: '', correo2: '' });
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const set = (k) => (ev) => setD({ ...d, [k]: ev.target.value });
  const ultima = useRef('');

  // La placa se consulta sola: medio segundo después de dejar de escribir.
  // Solo cuenta la respuesta de la última placa escrita.
  async function consultar(valor) {
    const pn = normPlaca(valor);
    if (pn.length < 6) return;
    ultima.current = pn;
    setConsultando(true); setError('');
    const r = await llamar({ accion: 'consultarRegimen', token: sesion.token, placa: valor, doi: d.doi });
    if (ultima.current !== pn) return;
    setConsultando(false);
    if (sinRespuestaClara(r)) { setError('No se pudo consultar la placa. Revisa la conexión.'); return; }
    if (!r.ok) { setError(r.error || 'No se pudo consultar la placa'); return; }
    setConsulta(r);
  }

  useEffect(() => {
    setConsulta(null); setFecha('');
    const pn = normPlaca(placa);
    if (pn.length < 6) { ultima.current = ''; setConsultando(false); return undefined; }
    const t = setTimeout(() => consultar(placa), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placa]);

  // Régimen y monto que verá la persona. Con lista: lo dice el servidor.
  // Sin lista: se calcula con la fecha de corte que mandó el servidor.
  let regimen = null, monto = null;
  if (consulta?.enLista) { regimen = 'NUEVA'; monto = consulta.monto; }
  else if (consulta && fecha) {
    regimen = fecha >= consulta.corte ? 'NUEVA' : 'ANTIGUA';
    monto = regimen === 'NUEVA' ? consulta.montoNueva : consulta.montoAntigua;
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const faltan = [];
  if (!consulta) faltan.push(consultando ? 'esperar la consulta de la placa' : 'placa');
  if (consulta?.duplicado) faltan.push('revisar el expediente en curso');
  if (consulta && !consulta.enLista && !fecha) faltan.push('fecha de firma');
  const doiNum = d.doi.replace(/\D/g, '');
  if (!doiNum) faltan.push('DOI');
  if (!d.nombre.trim()) faltan.push('nombre');
  else if (d.nombre.trim().length < 5) faltan.push('nombre completo');
  if (!d.credito.replace(/\D/g, '')) faltan.push('N° de crédito');
  if (!d.correo.trim()) faltan.push('correo');
  else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.correo.trim())) faltan.push('correo válido');
  else if (d.correo.trim().toLowerCase() !== d.correo2.trim().toLowerCase()) faltan.push('que los dos correos sean iguales');
  if (!archivo) faltan.push('comprobante');

  async function registrar() {
    setError('');
    if (faltan.length) { setError('Revisa: ' + faltan.join(' · ')); return; }
    setEnviando(true);
    let voucher;
    try { voucher = await leerArchivo(archivo); }
    catch { setEnviando(false); setError('No se pudo leer el comprobante. Vuelve a adjuntarlo.'); return; }
    if (voucher.tam > MAX_VOUCHER) {
      setEnviando(false);
      setError('El comprobante pesa más de 3 MB. Usa una foto o un PDF más liviano.');
      return;
    }
    let r;
    try {
      r = await llamar({
        accion: 'registrarSolicitud', token: sesion.token,
        placa, doi: d.doi, nombre: d.nombre, credito: d.credito,
        fechaFirma: consulta.enLista ? '' : fecha,
        correo: d.correo, correo2: d.correo2,
        voucher: { nombre: voucher.nombre, tipo: voucher.tipo, base64: voucher.base64 },
      });
    } finally { setEnviando(false); }

    if (sinRespuestaClara(r)) {
      // No se sabe si se grabó. No repetir a ciegas: el listado se recarga y,
      // si se grabó, la misma placa aparecerá como expediente en curso.
      setError(AVISO_ESCRITURA);
      onDudoso(AVISO_ESCRITURA);
      return;
    }
    if (!r.ok) { setError(r.error || 'No se pudo registrar'); return; }
    onListo(r.mensaje || `Solicitud ${r.id} registrada`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Registrar solicitud" style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(26,34,56,.45)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 12px',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: T.blanco, borderRadius: T.rCard,
        boxShadow: '0 10px 30px rgba(26,34,56,.25)', padding: '16px 18px 18px', color: T.texto,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0, color: T.navy }}>Registrar solicitud de levantamiento</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{
            background: 'none', border: 0, fontSize: 22, lineHeight: 1, color: T.texto2, cursor: 'pointer',
          }}>×</button>
        </div>

        <Campo etiqueta="Placa del vehículo" ayuda={consultando ? 'Consultando…' : 'Con o sin guion.'}>
          <input value={placa} autoFocus
            onChange={(ev) => setPlaca(ev.target.value.toUpperCase())}
            style={{ ...entrada, letterSpacing: '.08em', fontWeight: 600 }} placeholder="Ej.: 1234-AB" />
        </Campo>

        {consulta?.duplicado && (
          <Caja fondo={T.rojoBg} color={T.rojo}>
            Ya hay un expediente en curso para esta placa: <b>{consulta.duplicado}</b>. Revísalo en el tablero antes de registrar otro.
          </Caja>
        )}

        {consulta?.enLista && (
          <Caja fondo={T.azulBg} color={T.azul}>
            <div style={{ fontSize: 15 }}>
              Régimen <b>{LEY.NUEVA}</b> · Pagar <b>{soles(consulta.monto)}</b>
            </div>
          </Caja>
        )}

        {consulta && !consulta.enLista && (
          <>
            {consulta.avisoDoi && <Caja fondo={T.ambarBg} color={T.ambar}>{consulta.avisoDoi}</Caja>}
            <Campo etiqueta="Fecha de firma de la garantía mobiliaria" ayuda="El monto depende de esta fecha.">
              <input type="date" value={fecha} max={hoy} onChange={(ev) => setFecha(ev.target.value)} style={entrada} />
            </Campo>
            {regimen && (
              <Caja fondo={T.azulBg} color={T.azul}>
                <div style={{ fontSize: 15 }}>Régimen <b>{LEY[regimen]}</b> · Pagar <b>{soles(monto)}</b></div>
              </Caja>
            )}
          </>
        )}

        {(
          <>
            <Campo etiqueta="DOI del cliente"><input value={d.doi} onChange={set('doi')} inputMode="numeric" style={entrada} /></Campo>
            <Campo etiqueta="Nombre del cliente"><input value={d.nombre} onChange={set('nombre')} style={entrada} /></Campo>
            <Campo etiqueta="N° de crédito"><input value={d.credito} onChange={set('credito')} inputMode="numeric" style={entrada} /></Campo>
            <Campo etiqueta="Correo del cliente"><input type="email" value={d.correo} onChange={set('correo')} style={entrada} /></Campo>
            <Campo etiqueta="Repetir correo del cliente"><input type="email" value={d.correo2} onChange={set('correo2')} onPaste={(ev) => ev.preventDefault()} style={entrada} /></Campo>
            <Campo etiqueta="Comprobante de depósito" ayuda="PDF, JPG o PNG. Las fotos grandes se reducen solas.">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(ev) => {
                  const f = ev.target.files?.[0] || null;
                  if (f && !TIPOS.includes(f.type)) { setError('El comprobante debe ser PDF, JPG o PNG.'); setArchivo(null); return; }
                  setError(''); setArchivo(f);
                }} style={{ fontSize: 13 }} />
            </Campo>
          </>
        )}

        {error && <p style={{ fontSize: 12.5, color: T.rojo, margin: '4px 0 10px', lineHeight: 1.45 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <Btn primario onClick={registrar} disabled={enviando || !!consulta?.duplicado}>
            {enviando ? 'Registrando…' : 'Registrar solicitud'}
          </Btn>
          <Btn onClick={onCerrar}>Cancelar</Btn>
          {formAnterior && formAnterior !== '#' && (
            <a href={formAnterior} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11.5, color: T.texto3, marginLeft: 'auto' }}>Usar el formulario anterior</a>
          )}
        </div>
      </div>
    </div>
  );
}
