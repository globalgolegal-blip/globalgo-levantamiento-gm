'use client';

import { useEffect, useRef, useState } from 'react';
import { T } from './tokens';
import { sinRespuestaClara, AVISO_ESCRITURA } from './respuesta';

// Registrar una solicitud desde el tablero (reemplaza al formulario 1).
//
// 1. El DOI: el servidor lo consulta en el portal de Sistemas (un DOI a la vez;
//    si faltan ceros, como DNI y como CE). Si lo encuentra, completa nombre,
//    crédito, placa, fecha de firma y correo, y dice si puede pedir el
//    levantamiento (los que deben mora no se eligen). Si un dato no vino, el campo sale EN ROJO («Este dato no está en
//    el sistema») y se llena a mano. El correo sale EN NARANJA: se confirma con
//    el cliente porque pudo cambiar, y se puede corregir. Si el DOI no aparece,
//    todo se llena a mano como antes.
// 2. La placa: el servidor dice si está en la lista de tachados. Si está, es
//    NUEVA y no se pide la fecha. Si no, se pide la fecha de firma de la GM y el
//    monto sale de la fecha de corte de Catalogos. La lista nunca llega acá:
//    solo «está / no está», el régimen y el monto.

const MAX_VOUCHER = 3 * 1024 * 1024; // el puente de Vercel acepta ~4,5 MB por petición
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const normPlaca = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// DOI y N° de crédito pueden traer letras (CE, códigos del portal): solo se quitan espacios y signos.
const normDoi = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normCred = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
const soles = (n) => 'S/ ' + Number(n || 0).toFixed(2);
const LEY = { NUEVA: 'NUEVA · DL 1400', ANTIGUA: 'ANTIGUA · Ley 28677' };

// Nombre de cada dato tal como se anota en la bitácora.
const NOMBRE_DATO = { nombre: 'nombre', credito: 'N° de crédito', placa: 'placa', fecha: 'fecha de firma', correo: 'correo' };

const entrada = {
  width: '100%', border: `0.5px solid ${T.linea2}`, background: T.blanco, color: T.texto,
  borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box',
};

// Cómo se ve la casilla según de dónde vino el dato.
//   falta      → no vino del sistema y sigue vacía: ROJO.
//   confirmar  → el correo vino del sistema: NARANJA, se confirma con el cliente.
//   (resto)    → normal.
function estiloCasilla(estado) {
  if (estado === 'falta') return { ...entrada, border: `1.5px solid ${T.rojo}`, background: T.rojoBg };
  if (estado === 'confirmar') return { ...entrada, border: `1.5px solid ${T.naranja}`, background: T.naranjaBg };
  return entrada;
}

function Campo({ etiqueta, ayuda, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.texto }}>{etiqueta}</span>
      {children}
      {ayuda && <span style={{ fontSize: 11, color: T.texto3 }}>{ayuda}</span>}
    </label>
  );
}

/**
 * Casilla de un dato que puede venir del sistema.
 * `estado`: null (sin búsqueda) · 'sistema' · 'editado' · 'falta' · 'manual' · 'confirmar' · 'cambiado'.
 * `idCasilla`: el botón rojo lleva el cursor a esta casilla.
 */
function CampoDato({ etiqueta, ayuda, estado, original, idCasilla, children }) {
  let nota = null;
  if (estado === 'falta') {
    nota = (
      <button type="button" onClick={() => document.getElementById(idCasilla)?.focus()} style={{
        alignSelf: 'flex-start', border: `1px solid ${T.rojo}`, background: T.rojoBg, color: T.rojo,
        borderRadius: T.rPill, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
      }}>Este dato no está en el sistema · Llénalo a mano</button>
    );
  } else if (estado === 'confirmar') {
    nota = (
      <span style={{ fontSize: 11.5, color: T.naranjaTx, fontWeight: 600 }}>
        Confirma este dato con el cliente: podría haber cambiado. Si cambió, corrígelo aquí.
      </span>
    );
  } else if (estado === 'cambiado') {
    nota = <span style={{ fontSize: 11, color: T.naranjaTx }}>Corregido a mano. Antes decía: {original}</span>;
  } else if (estado === 'editado') {
    nota = <span style={{ fontSize: 11, color: T.ambar }}>Cambiado a mano. En el sistema dice: {original}</span>;
  } else if (estado === 'manual') {
    nota = <span style={{ fontSize: 11, color: T.texto3 }}>Llenado a mano (no estaba en el sistema)</span>;
  } else if (estado === 'sistema') {
    nota = <span style={{ fontSize: 11, color: T.texto3 }}>Del sistema de créditos</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <label htmlFor={idCasilla} style={{ fontSize: 12, fontWeight: 600, color: T.texto }}>{etiqueta}</label>
      {children}
      {nota}
      {ayuda && <span style={{ fontSize: 11, color: T.texto3 }}>{ayuda}</span>}
    </div>
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
export async function leerArchivo(file) {
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

  // Búsqueda del DOI en el portal de Sistemas.
  //   hoja: null · { estado: 'buscando' | 'encontrado' | 'no_encontrado' | 'sin_datos' | 'error', doi, creditos?, error? }
  //   auto: lo que trajo el sistema para el crédito elegido ('' = no vino), o null.
  const [hoja, setHoja] = useState(null);
  const [auto, setAuto] = useState(null);
  // Aunque los datos los traiga el sistema, quien registra los ratifica con el cliente.
  const [ratificado, setRatificado] = useState(false);
  const [elegidoAMano, setElegidoAMano] = useState(false);
  const doiBuscado = useRef('');

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
    setConsulta(null);
    // Con datos del sistema, la fecha es la del crédito elegido: no cambia con la placa
    // (si la placa no vino y se escribe a mano, la fecha del sistema se conserva).
    setFecha((f) => (auto ? (f || auto.fecha) : ''));
    const pn = normPlaca(placa);
    if (pn.length < 6) { ultima.current = ''; setConsultando(false); return undefined; }
    const t = setTimeout(() => consultar(placa), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placa]);

  /** Quita de las casillas lo que había puesto el sistema (lo escrito a mano se queda). */
  function soltarAuto() {
    if (!auto) return;
    const a = auto;
    setD((p) => {
      const n = { ...p };
      if (a.nombre && n.nombre.trim() === a.nombre) n.nombre = '';
      if (a.credito && normCred(n.credito) === a.credito) n.credito = '';
      if (a.correo && n.correo.trim().toLowerCase() === a.correo) { n.correo = ''; n.correo2 = ''; }
      return n;
    });
    if (a.placa && normPlaca(placa) === a.placa) setPlaca('');
    if (a.fecha && fecha === a.fecha) setFecha('');
    setAuto(null);
    setRatificado(false);
  }

  /** Pone en las casillas los datos del crédito elegido. */
  function elegir(c, aMano = false) {
    const a = {
      codigo: String(c.codigo || c.credito || ''), credito: normCred(c.credito), nombre: String(c.nombre || '').trim(),
      doi: normDoi(c.doi),
      placa: normPlaca(c.placa), fecha: c.fechaFirma || '',
      correo: String(c.correo || '').trim().toLowerCase(), fechaCancelacion: c.fechaCancelacion || '',
    };
    setAuto(a);
    setRatificado(false);
    setElegidoAMano(aMano);
    // El DOI queda como está en el sistema (completo, con sus ceros).
    setD((p) => ({ ...p, doi: a.doi || p.doi, nombre: a.nombre, credito: a.credito, correo: a.correo, correo2: a.correo }));
    setPlaca(a.placa);
    setFecha(a.fecha);
    setError('');
  }

  async function buscarDoi() {
    const dn = normDoi(d.doi);
    if (dn.length < 6) { setError('Escribe el documento del cliente (DNI o CE).'); return; }
    if (hoja && hoja.doi === dn && hoja.estado !== 'error') return;
    soltarAuto();
    doiBuscado.current = dn;
    setError('');
    setHoja({ estado: 'buscando', doi: dn });
    const r = await llamar({ accion: 'buscarDoi', token: sesion.token, doi: dn });
    if (doiBuscado.current !== dn) return; // ya escribieron otro DOI
    if (sinRespuestaClara(r) || !r.ok) {
      setHoja({ estado: 'error', doi: dn, error: (r && r.error) || 'No se pudo buscar el DOI.' });
      return;
    }
    const creditos = Array.isArray(r.creditos) ? r.creditos : [];
    if (!r.disponible) setHoja({ estado: 'sin_datos', doi: dn });
    else if (!creditos.length) setHoja({ estado: 'no_encontrado', doi: dn });
    else {
      setHoja({ estado: 'encontrado', doi: dn, creditos, firmaNoDisponible: r.firmaNoDisponible === true });
      const c = creditoPorDefecto(creditos);
      if (c) elegir(c);
    }
  }

  /**
   * El sistema elige el crédito solo: el cancelado más reciente que puede pedir
   * el levantamiento y todavía no tiene expediente. Quien registra no marca
   * nada; solo lo cambia si el cliente viene por otro. Los que no pueden (debe
   * mora, tiene saldo…) nunca se eligen. Si no queda ninguno, no elige.
   */
  function creditoPorDefecto(lista) {
    const pendientes = lista.filter((c) => c.puedePedir !== false && !c.tramitado);
    // Si lo escrito coincide con dos documentos distintos (un DNI y un CE), no se
    // elige nada: quien registra pregunta al cliente cuál es el suyo.
    if (new Set(pendientes.map((c) => c.doi || '')).size > 1) return null;
    pendientes.sort((a, b) => String(b.fechaCancelacion || '').localeCompare(String(a.fechaCancelacion || '')));
    return pendientes[0] || null;
  }

  function cambiarDoi(ev) {
    const v = ev.target.value;
    setD((p) => ({ ...p, doi: v }));
    if (hoja && normDoi(v) !== hoja.doi && !(auto && normDoi(v) === auto.doi)) {
      doiBuscado.current = '';
      setHoja(null);
      soltarAuto();
    }
  }

  // Estado de cada casilla respecto de lo que trajo el sistema.
  function estadoDe(k, valor) {
    if (!auto) return null;
    const v = k === 'placa' ? normPlaca(valor) : k === 'credito' ? normCred(valor)
      : k === 'correo' ? String(valor || '').trim().toLowerCase() : String(valor || '').trim();
    if (k === 'correo') {
      if (!auto.correo) return v ? 'manual' : 'falta';
      return v === auto.correo ? 'confirmar' : 'cambiado';
    }
    if (!auto[k]) return v ? 'manual' : 'falta';
    return v === auto[k] ? 'sistema' : 'editado';
  }
  const est = {
    nombre: estadoDe('nombre', d.nombre),
    credito: estadoDe('credito', d.credito),
    placa: estadoDe('placa', placa),
    fecha: estadoDe('fecha', fecha),
    correo: estadoDe('correo', d.correo),
  };

  // El correo que vino del sistema y no se tocó no necesita repetirse: no hubo tipeo.
  const correoDelSistema = est.correo === 'confirmar';

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
  const doiNum = normDoi(d.doi);
  if (!doiNum) faltan.push('DOI');
  if (hoja?.estado === 'buscando') faltan.push('esperar la búsqueda del DOI');
  if (hoja?.estado === 'encontrado' && !auto) faltan.push('elegir el crédito');
  if (!consulta) faltan.push(consultando ? 'esperar la consulta de la placa' : 'placa');
  if (consulta?.duplicado) faltan.push('revisar el expediente en curso');
  if (consulta && !consulta.enLista && !fecha) faltan.push('fecha de firma');
  if (!d.nombre.trim()) faltan.push('nombre');
  else if (d.nombre.trim().length < 5) faltan.push('nombre completo');
  if (!normCred(d.credito)) faltan.push('N° de crédito');
  if (!d.correo.trim()) faltan.push('correo');
  else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.correo.trim())) faltan.push('correo válido');
  else if (!correoDelSistema && d.correo.trim().toLowerCase() !== d.correo2.trim().toLowerCase()) faltan.push('que los dos correos sean iguales');
  if (!archivo) faltan.push('comprobante');
  if (auto && !ratificado) faltan.push('ratificar los datos con el cliente');

  /** Lo que se anota en la bitácora sobre el origen de los datos. */
  function resumenHoja() {
    if (!hoja) return null;
    if (hoja.estado === 'encontrado' && auto) {
      const campos = ['nombre', 'credito', 'placa', 'correo'];
      if (consulta && !consulta.enLista) campos.push('fecha');
      return {
        estado: 'encontrado',
        credito: auto.credito,
        codigo: auto.codigo,
        ratificado,
        faltaban: campos.filter((k) => !auto[k]).map((k) => NOMBRE_DATO[k]),
        cambiados: campos.filter((k) => ['editado', 'cambiado'].includes(est[k])).map((k) => NOMBRE_DATO[k]),
      };
    }
    if (hoja.estado === 'no_encontrado' || hoja.estado === 'sin_datos') return { estado: hoja.estado };
    return null;
  }

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
        correo: d.correo, correo2: correoDelSistema ? d.correo : d.correo2,
        voucher: { nombre: voucher.nombre, tipo: voucher.tipo, base64: voucher.base64 },
        hoja: resumenHoja(),
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

  const creditos = hoja?.estado === 'encontrado' ? hoja.creditos : [];
  const elegibles = creditos.filter((c) => c.puedePedir !== false && !c.tramitado);
  // Créditos del mismo cliente que el elegido (los de otro documento son otra persona).
  const mismoDoc = auto ? creditos.filter((c) => !auto.doi || !c.doi || c.doi === auto.doi) : creditos;

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

        <Campo etiqueta="DOI del cliente" ayuda="DNI o CE. Pulsa Buscar: los datos se llenan solos. Si faltan ceros, el sistema busca el documento completo.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={d.doi} autoFocus onChange={cambiarDoi}
              onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); buscarDoi(); } }}
              style={{ ...entrada, fontWeight: 600 }} placeholder="Ej.: 12345678 o 001234567" />
            <Btn primario onClick={buscarDoi} disabled={hoja?.estado === 'buscando'}>
              {hoja?.estado === 'buscando' ? 'Buscando…' : 'Buscar'}
            </Btn>
          </div>
        </Campo>

        {auto && auto.doi && hoja && auto.doi !== hoja.doi && (
          <p style={{ fontSize: 11.5, color: T.azul, margin: '-4px 0 10px' }}>
            Documento completo según el sistema: <b>{auto.doi}</b>. Confírmalo con el cliente junto con su nombre.
          </p>
        )}

        {hoja?.estado === 'no_encontrado' && (
          <Caja fondo={T.ambarBg} color={T.ambar}>
            Este documento <b>no tiene créditos</b> en el sistema de créditos (se buscó como DNI y como CE).
            Revisa que esté bien escrito y confirma que el cliente terminó de pagar. Si es así, llena los datos a mano.
          </Caja>
        )}
        {hoja?.estado === 'sin_datos' && (
          <Caja fondo={T.neutroBg} color={T.linea2}>
            La consulta al sistema de créditos no está disponible ahora. Llena los datos a mano.
          </Caja>
        )}
        {hoja?.estado === 'error' && (
          <Caja fondo={T.neutroBg} color={T.linea2}>
            No se pudo buscar el DOI ({hoja.error}). Puedes volver a intentar o llenar los datos a mano.
          </Caja>
        )}

        {hoja?.estado === 'encontrado' && !auto && elegibles.length > 0 && (
          <Caja fondo={T.azulBg} color={T.azul}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Lo que escribiste coincide con más de un documento. Pregúntale al cliente su documento completo y su
              nombre, y elige:
            </div>
            {elegibles.map((c, i) => (
              <div key={(c.codigo || '') + '-' + i} style={{ fontSize: 12.5, padding: '3px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>
                  Documento <b>{c.doi}</b> · <b>{c.nombre}</b> · crédito {c.credito || 's/n'}
                  {c.placa ? <> · placa {c.placa}</> : ''}
                </span>
                <button type="button" onClick={() => elegir(c, true)} style={{
                  border: `0.5px solid ${T.azul}`, background: T.blanco, color: T.azul, borderRadius: T.rPill,
                  padding: '2px 10px', fontSize: 11.5, cursor: 'pointer',
                }}>Es este cliente</button>
              </div>
            ))}
          </Caja>
        )}

        {hoja?.estado === 'encontrado' && !auto && elegibles.length === 0 && (
          <Caja fondo={T.rojoBg} color={T.rojo}>
            <div style={{ fontWeight: 600, color: T.rojo, marginBottom: 4 }}>
              {creditos.length > 1 ? 'Ninguno de los créditos de este cliente' : 'El crédito de este cliente no'}
              {creditos.length > 1 ? ' puede pedir el levantamiento ahora:' : ' puede pedir el levantamiento ahora:'}
            </div>
            {creditos.map((c, i) => (
              <div key={(c.credito || '') + '-' + i} style={{ fontSize: 12.5, padding: '2px 0' }}>
                Crédito <b>{c.credito || 's/n'}</b>{c.placa ? <> · placa <b>{c.placa}</b></> : ''}
                {' · '}{c.puedePedir === false ? <b style={{ color: T.rojo }}>{c.motivo}</b> : <>ya tiene expediente <b>{c.tramitado}</b></>}
              </div>
            ))}
            <div style={{ fontSize: 12, marginTop: 4 }}>No registres la solicitud: explícale al cliente el motivo o consulta a Cobranza.</div>
          </Caja>
        )}

        {auto && mismoDoc.length > 1 && (
          <Caja fondo={T.azulBg} color={T.azul}>
            <div>
              {elegidoAMano ? 'Elegiste el crédito ' : 'El sistema eligió el crédito '}<b>{auto.credito || 's/n'}</b>
              {auto.placa ? <> (placa <b>{auto.placa}</b>)</> : ''}
              {elegidoAMano ? '.' : ': es el cancelado más reciente que aún no tiene levantamiento.'}
            </div>
            {mismoDoc.some((c) => c.puedePedir !== false && !c.tramitado && normCred(c.credito) !== auto.credito) && (
              <div style={{ marginTop: 6, fontWeight: 600 }}>
                Este cliente tiene más de una garantía por levantar. Cada una es una solicitud aparte (con su
                propio pago): registra esta y luego vuelve a buscar el DOI; el sistema elegirá la siguiente.
              </div>
            )}
            <div style={{ fontSize: 12, color: T.texto2, margin: '6px 0 2px' }}>Este cliente tiene otros créditos:</div>
            {mismoDoc.filter((c) => normCred(c.credito) !== auto.credito).map((c, i) => (
              <div key={(c.credito || '') + '-' + i} style={{ fontSize: 12.5, padding: '2px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>
                  Crédito <b>{c.credito || 's/n'}</b>{' · placa '}<b>{c.placa || 'no está en el sistema'}</b>
                  {c.fechaCancelacion ? ` · cancelado el ${c.fechaCancelacion}` : ''}
                </span>
                {c.puedePedir === false
                  ? <span style={{ fontSize: 11.5, color: T.rojo, fontWeight: 600 }}>No puede: {c.motivo}</span>
                  : c.tramitado
                  ? <span style={{ fontSize: 11.5, color: T.texto3 }}>ya tiene expediente {c.tramitado}</span>
                  : (
                    <button type="button" onClick={() => elegir(c, true)} style={{
                      border: `0.5px solid ${T.azul}`, background: T.blanco, color: T.azul, borderRadius: T.rPill,
                      padding: '2px 10px', fontSize: 11.5, cursor: 'pointer',
                    }}>El cliente viene por este</button>
                  )}
              </div>
            ))}
          </Caja>
        )}

        {auto && hoja?.firmaNoDisponible && (
          <Caja fondo={T.ambarBg} color={T.ambar}>
            El sistema no pudo leer la <b>fecha de firma</b> en este momento. Vuelve a buscar en unos minutos o
            llénala a mano con el contrato.
          </Caja>
        )}

        {auto && auto.fechaCancelacion && mismoDoc.length <= 1 && (
          <p style={{ fontSize: 11.5, color: T.texto3, margin: '-4px 0 10px' }}>
            Crédito cancelado el {auto.fechaCancelacion}.
          </p>
        )}

        {auto && (
          <Caja fondo={T.azulBg} color={T.azul}>
            Los datos se llenaron desde el sistema de créditos, pero <b>debes ratificarlos con el cliente</b> antes
            de registrar. Si algo no coincide, corrígelo. Lo que sale <b style={{ color: T.rojo }}>en rojo</b> no
            está en el sistema y se llena a mano; lo que sale <b style={{ color: T.naranjaTx }}>en naranja</b> pudo
            haber cambiado.
          </Caja>
        )}

        <CampoDato etiqueta="Placa del vehículo" estado={est.placa} original={auto?.placa} idCasilla="rs-placa"
          ayuda={consultando ? 'Consultando…' : 'Con o sin guion.'}>
          <input id="rs-placa" value={placa}
            onChange={(ev) => setPlaca(ev.target.value.toUpperCase())}
            style={{ ...estiloCasilla(est.placa), letterSpacing: '.08em', fontWeight: 600 }} placeholder="Ej.: 1234-AB" />
        </CampoDato>

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
            <CampoDato etiqueta="Fecha de firma de la garantía mobiliaria" estado={est.fecha} original={auto?.fecha}
              idCasilla="rs-fecha" ayuda="El monto depende de esta fecha.">
              <input id="rs-fecha" type="date" value={fecha} max={hoy} onChange={(ev) => setFecha(ev.target.value)}
                style={estiloCasilla(est.fecha)} />
            </CampoDato>
            {regimen && (
              <Caja fondo={T.azulBg} color={T.azul}>
                <div style={{ fontSize: 15 }}>Régimen <b>{LEY[regimen]}</b> · Pagar <b>{soles(monto)}</b></div>
              </Caja>
            )}
          </>
        )}

        <CampoDato etiqueta="Nombre del cliente" estado={est.nombre} original={auto?.nombre} idCasilla="rs-nombre">
          <input id="rs-nombre" value={d.nombre} onChange={set('nombre')} style={estiloCasilla(est.nombre)} />
        </CampoDato>
        <CampoDato etiqueta="N° de crédito" estado={est.credito} original={auto?.credito} idCasilla="rs-credito">
          <input id="rs-credito" value={d.credito} onChange={set('credito')} style={estiloCasilla(est.credito)} />
        </CampoDato>
        <CampoDato etiqueta="Correo del cliente" estado={est.correo} original={auto?.correo} idCasilla="rs-correo">
          <input id="rs-correo" type="email" value={d.correo} style={estiloCasilla(est.correo)}
            onChange={(ev) => {
              const v = ev.target.value;
              // Si se corrige el correo que trajo el sistema, hay que volver a escribirlo abajo.
              setD((p) => ({ ...p, correo: v, correo2: auto && auto.correo && p.correo2 === auto.correo ? '' : p.correo2 }));
            }} />
        </CampoDato>
        {!correoDelSistema && (
          <Campo etiqueta="Repetir correo del cliente">
            <input type="email" value={d.correo2} onChange={set('correo2')} onPaste={(ev) => ev.preventDefault()} style={entrada} />
          </Campo>
        )}
        <Campo etiqueta="Comprobante de depósito" ayuda="PDF, JPG o PNG. Las fotos grandes se reducen solas.">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(ev) => {
              const f = ev.target.files?.[0] || null;
              if (f && !TIPOS.includes(f.type)) { setError('El comprobante debe ser PDF, JPG o PNG.'); setArchivo(null); return; }
              setError(''); setArchivo(f);
            }} style={{ fontSize: 13 }} />
        </Campo>

        {auto && (
          <label style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, margin: '2px 0 12px', cursor: 'pointer',
            padding: '8px 10px', borderRadius: 8, border: `1px solid ${ratificado ? T.linea2 : T.azul}`,
            background: ratificado ? T.blanco : T.azulBg,
          }}>
            <input type="checkbox" checked={ratificado} onChange={(ev) => setRatificado(ev.target.checked)} />
            <span>Ratifiqué con el cliente que el documento, el nombre, la placa, el crédito y el correo son correctos.</span>
          </label>
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
