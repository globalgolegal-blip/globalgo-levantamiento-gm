'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  T, COLOR_ESTADO, FONDO_ESTADO, TARJETAS, ESTADOS_POR_ROL, MOTIVOS, MOTIVOS_ANULAR,
} from './tokens';

// Solo quedan los formularios que suben archivos.
const FORM_COBRANZA    = process.env.NEXT_PUBLIC_LGM_FORM_COBRANZA    || '#';
const FORM_CIERRE      = process.env.NEXT_PUBLIC_LGM_FORM_CIERRE      || '#';
const FORM_COMPROBANTE = process.env.NEXT_PUBLIC_LGM_FORM_COMPROBANTE || '#';

const LLAVE_SESION = 'lgm_sesion';

// Esta web vive aparte de GoTrack; la barra enlaza de vuelta a los otros módulos.
const GOTRACK = process.env.NEXT_PUBLIC_GOTRACK_URL || 'https://gotrack-go.vercel.app';

/* ─────────────────────────────── helpers */

const fecha = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fechaHora = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? '' : d.toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const soles = (n) => 'S/ ' + Number(n || 0).toFixed(2);

const anulado = (e) => e.estado === 'ANULADO';
const activo = (e) => !['CERRADO', 'LEVANTADO', 'ANULADO'].includes(e.estado);
const congelado = (e) => e.estado === 'EN SUNARP' || (!!e.titulo && !e.fechaInscripcion);
const vencido = (e) => activo(e) && !congelado(e) && e.sla > 0 && e.diasGo > e.sla;
const venceHoy = (e) => activo(e) && !congelado(e) && e.sla > 0 && e.diasGo === e.sla;

function chipPlazo(e) {
  if (anulado(e)) return ['Anulado', T.neutroBg, T.texto3];
  if (congelado(e)) return [`${e.diasRegistro} d en registro público · reloj detenido`, T.neutroBg, T.texto2];
  if (e.estado === 'CERRADO') return [`Cerrado en ${e.diasGo} d`, T.neutroBg, T.navy];
  if (e.estado === 'LEVANTADO') return [`Levantado en ${e.diasGo} d`, T.neutroBg, T.navy];
  if (!e.sla) return [`${e.diasGo} d`, T.neutroBg, T.texto2];
  if (vencido(e)) return [`Vencido · ${e.diasGo} d de ${e.sla}`, T.rojoBg, T.rojo];
  if (venceHoy(e)) return [`Vence hoy · ${e.diasGo} d de ${e.sla}`, T.ambarBg, T.ambar];
  return [`En plazo · ${e.diasGo} d de ${e.sla}`, T.azulBg, T.azul];
}

function hitos(e) {
  const l = [];
  if (e.fechaSolicitud)    l.push(['Solicitud registrada por Cobranza', e.fechaSolicitud, 'ok']);
  if (e.fechaValidacion)   l.push([`Tesorería validó el depósito de ${soles(e.monto)}`, e.fechaValidacion, 'ok']);
  if (e.notaria)           l.push(['Ingresado a notaría Quintanilla', e.notaria, 'ok']);
  if (e.fechaPresentacion) l.push([`Presentado a SUNARP · título ${e.titulo || '—'}`, e.fechaPresentacion, 'ok']);
  if (e.fechaInscripcion)  l.push(['Inscrito en SUNARP', e.fechaInscripcion, 'ok']);
  if (e.fechaCierre && !anulado(e)) l.push(['Correo de cierre enviado con la boleta', e.fechaCierre, 'ok']);
  if (anulado(e))          l.push(['Expediente anulado', e.fechaCierre, 'alerta']);
  if (activo(e))           l.push([`Pendiente · responsable ${e.responsable}`, null, 'ahora']);
  return l;
}

async function llamar(cuerpo) {
  try {
    const r = await fetch('/api/lgm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: 'Sin conexión con el servidor' };
  }
}

/* ─────────────────────────────── piezas */

function Pastilla({ texto, fondo, color }) {
  return (
    <span style={{
      background: fondo, color, fontSize: 11, fontWeight: 600,
      padding: '3px 9px', borderRadius: T.rPill, whiteSpace: 'nowrap',
    }}>{texto}</span>
  );
}

function Filtro({ activa, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: '5px 12px', borderRadius: T.rPill,
      background: activa ? T.navy : T.blanco,
      color: activa ? T.blanco : T.navy,
      border: `0.5px solid ${activa ? T.navy : T.linea2}`,
      cursor: 'pointer', transition: '.15s',
    }}>{children}</button>
  );
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
      color: T.texto3, fontWeight: 600,
    }}>{children}</span>
  );
}

/** Foto de la persona. Si no hay foto, sus iniciales en un círculo. */
function Avatar({ usuario, foto, tam = 30 }) {
  const iniciales = String(usuario || '?')
    .replace(/[^A-Za-zÁÉÍÓÚÑ. ]/g, '')
    .split(/[\s.]+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase();

  const base = {
    width: tam, height: tam, borderRadius: '50%', flex: 'none',
    border: `0.5px solid ${T.linea}`, objectFit: 'cover',
  };

  if (foto) {
    return <img src={foto} alt={usuario} style={base} referrerPolicy="no-referrer" />;
  }
  return (
    <span style={{
      ...base, background: T.neutroBg, color: T.texto2,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(tam * 0.36), fontWeight: 600, letterSpacing: '.02em',
    }}>{iniciales}</span>
  );
}

function Boton({ children, onClick, primario, peligro, disabled, href }) {
  const estilo = {
    border: `0.5px solid ${peligro ? T.rojo : primario ? T.navy : T.linea2}`,
    background: primario ? T.navy : peligro ? T.rojoBg : T.blanco,
    color: primario ? T.blanco : peligro ? T.rojo : T.texto,
    borderRadius: T.rInput, padding: '7px 12px', fontSize: 13, fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    textDecoration: 'none', display: 'inline-block',
  };
  if (href) return <a href={href} target="_blank" rel="noreferrer" style={estilo}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} style={estilo}>{children}</button>;
}

function Campo({ etiqueta, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{etiqueta}</span>
      {children}
    </label>
  );
}

const estiloEntrada = {
  width: '100%', border: `0.5px solid ${T.linea2}`, background: T.blanco, color: T.texto,
  borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13,
};

/* ─────────────────────────────── identificación */

function BarraSesion({ sesion, setSesion, usuarios }) {
  const [abierto, setAbierto] = useState(false);
  const [area, setArea] = useState('cobranza');
  const [elegido, setElegido] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const delArea = usuarios.filter((u) => u.area === area);

  async function entrar() {
    setCargando(true); setError('');
    const r = await llamar({ accion: 'entrar', usuario: elegido.usuario, pin });
    setCargando(false);
    if (!r.ok) { setError(r.error || 'No se pudo entrar'); setPin(''); return; }
    const s = { token: r.token, area: r.area, usuario: r.usuario, nombre: r.nombre, foto: r.foto };
    localStorage.setItem(LLAVE_SESION, JSON.stringify(s));
    setSesion(s);
    setAbierto(false); setElegido(null); setPin('');
  }

  function salir() {
    localStorage.removeItem(LLAVE_SESION);
    setSesion(null);
  }

  if (sesion) {
    return (
      <span style={{
        display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: T.texto2,
        alignSelf: 'flex-end',
      }}>
        <Avatar usuario={sesion.usuario} foto={sesion.foto} tam={26} />
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <b style={{ color: T.texto, fontSize: 12 }}>{sesion.usuario}</b>
          <span style={{ textTransform: 'capitalize', fontSize: 11 }}>{sesion.area}</span>
        </span>
        <button onClick={salir} style={{
          background: 'none', border: 0, color: T.azul, fontSize: 12, cursor: 'pointer', padding: 0,
        }}>Salir</button>
      </span>
    );
  }

  return (
    <>
      <button onClick={() => setAbierto(!abierto)} style={{
        width: '100%', textAlign: 'center', fontSize: 12, fontWeight: 600,
        padding: '8px 12px', borderRadius: T.rPill,
        background: T.blanco, color: T.navy, border: `0.5px solid ${T.linea2}`, cursor: 'pointer',
      }}>ACCEDER PARA EDITAR</button>
      {abierto && (
        <div style={{
          width: '100%', marginTop: 8, background: T.crema, border: `0.5px solid ${T.linea}`,
          borderRadius: T.rCard, padding: 14,
        }}>
          {!usuarios.length ? (
            <p style={{ fontSize: 12.5, color: T.texto2 }}>
              No hay usuarios cargados. Agrégalos en la hoja Usuarios del archivo de la base.
            </p>
          ) : !elegido ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                {[['cobranza', 'Cobranza'], ['tesoreria', 'Tesorería'], ['legal', 'Legal']].map(([k, txt]) => (
                  <Filtro key={k} activa={area === k} onClick={() => setArea(k)}>{txt}</Filtro>
                ))}
              </div>
              {delArea.length === 0 ? (
                <p style={{ fontSize: 12.5, color: T.texto2 }}>Nadie registrado en esta área todavía.</p>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                }}>
                  {delArea.map((u) => (
                    <button key={u.usuario} onClick={() => { setElegido(u); setError(''); }} style={{
                      display: 'flex', gap: 9, alignItems: 'center', textAlign: 'left',
                      background: T.blanco, border: `0.5px solid ${T.linea}`,
                      borderRadius: T.rInput, padding: '8px 10px', cursor: 'pointer',
                    }}>
                      <Avatar usuario={u.usuario} foto={u.foto} tam={30} />
                      <span style={{ minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: 12.5, color: T.texto }}>{u.usuario}</b>
                        <span style={{
                          display: 'block', fontSize: 11, color: T.texto2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{u.nombre}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <Avatar usuario={elegido.usuario} foto={elegido.foto} tam={38} />
                <span>
                  <b style={{ display: 'block', fontSize: 13.5 }}>{elegido.nombre}</b>
                  <span style={{ fontSize: 12, color: T.texto2, textTransform: 'capitalize' }}>{elegido.area}</span>
                </span>
                <span style={{ flex: 1 }} />
                <button onClick={() => { setElegido(null); setPin(''); setError(''); }} style={{
                  background: 'none', border: 0, color: T.azul, fontSize: 12, cursor: 'pointer',
                }}>Cambiar</button>
              </div>
              <Campo etiqueta="Tu PIN">
                <input
                  type="password" inputMode="numeric" value={pin} autoFocus
                  onChange={(ev) => setPin(ev.target.value.replace(/\D/g, ''))}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' && pin) entrar(); }}
                  style={{ ...estiloEntrada, letterSpacing: '.3em', fontSize: 16 }}
                />
              </Campo>
              {error && <p style={{ fontSize: 12, color: T.rojo, marginBottom: 8 }}>{error}</p>}
              <p style={{ fontSize: 11.5, color: T.texto2, marginBottom: 10, lineHeight: 1.5 }}>
                Tu nombre queda en la bitácora en cada cambio que hagas.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Boton primario onClick={entrar} disabled={cargando || pin.length < 4}>
                  {cargando ? 'Entrando…' : 'Entrar'}
                </Boton>
                <Boton onClick={() => setAbierto(false)}>Cancelar</Boton>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────── acciones de una ficha */

function Acciones({ e, sesion, onListo }) {
  const [panel, setPanel] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [texto, setTexto] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState(hoyISO());
  const [avisar, setAvisar] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const area = sesion?.area;
  const esNueva = e.regimen === 'NUEVA';

  function abrir(cual) {
    setPanel(cual); setError(''); setMotivo(''); setTexto('');
    setValor(''); setDia(hoyISO()); setAvisar(false);
  }

  async function enviar(accion, extra) {
    setCargando(true); setError('');
    const r = await llamar({ accion, id: e.id, token: sesion.token, ...extra });
    setCargando(false);
    if (!r.ok) { setError(r.error || 'No se pudo guardar'); return; }
    setPanel(null);
    onListo(r.mensaje);
  }

  if (!sesion) {
    return (
      <p style={{ fontSize: 12, color: T.texto2 }}>
        Identifícate arriba para poder editar este expediente.
      </p>
    );
  }

  const botones = [];
  if (area === 'tesoreria' && e.estado === 'SOLICITADO') {
    botones.push(<Boton key="v" primario disabled={cargando} onClick={() => enviar('validar')}>Validar pago</Boton>);
    botones.push(<Boton key="o" onClick={() => abrir('observar')}>Observar</Boton>);
  }
  if (area === 'legal') {
    if (e.estado === 'PAGO OK' && esNueva) {
      botones.push(<Boton key="s" primario disabled={cargando} onClick={() => enviar('sigm')}>Levantar en SIGM</Boton>);
    }
    if ((e.estado === 'PAGO OK' || e.estado === 'EN TRÁMITE') && !esNueva) {
      botones.push(<Boton key="n" primario onClick={() => abrir('notaria')}>Registrar ingreso a notaría</Boton>);
    }
    if (e.estado === 'EN NOTARÍA') {
      botones.push(<Boton key="t" primario onClick={() => abrir('titulo')}>Registrar N° de título</Boton>);
    }
    if ((e.estado === 'EN TRÁMITE' && esNueva) || e.estado === 'EN SUNARP') {
      botones.push(<Boton key="c" primario href={FORM_CIERRE}>Cargar boleta y cerrar</Boton>);
    }
    if (['PAGO OK', 'EN TRÁMITE', 'EN NOTARÍA', 'EN SUNARP'].includes(e.estado)) {
      botones.push(<Boton key="o" onClick={() => abrir('observar')}>Observar</Boton>);
    }
    if (activo(e)) {
      botones.push(<Boton key="a" peligro onClick={() => abrir('anular')}>Anular</Boton>);
    }
  }
  if (area === 'cobranza' && e.estado.startsWith('OBS.')) {
    botones.push(<Boton key="r" primario onClick={() => abrir('responder')}>Responder la observación</Boton>);
    botones.push(<Boton key="cp" href={FORM_COMPROBANTE}>Reemplazar comprobante</Boton>);
  }

  if (!botones.length && !panel) {
    return (
      <p style={{ fontSize: 12, color: T.texto2 }}>
        {anulado(e) ? 'Expediente anulado. No admite cambios.'
          : e.estado === 'CERRADO' ? 'Expediente cerrado. No admite cambios.'
          : `Este expediente le toca a ${e.responsable}.`}
      </p>
    );
  }

  const listoObservar = motivo && texto.trim().length >= 10;
  const listoAnular = motivo && texto.trim().length >= 10;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{botones}</div>

      {panel === 'observar' && (
        <div style={{
          marginTop: 11, background: T.naranjaBg, border: `0.5px solid ${T.naranja}`,
          borderRadius: T.rInput, padding: 12,
        }}>
          <h6 style={{
            margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: T.naranjaTx,
            textTransform: 'uppercase', letterSpacing: '.06em',
          }}>Observar — indica qué debe corregir Cobranza</h6>
          <select value={motivo} onChange={(ev) => setMotivo(ev.target.value)} style={{ ...estiloEntrada, marginBottom: 8 }}>
            <option value="">Elige el motivo…</option>
            {(MOTIVOS[area] || []).map((m) => <option key={m}>{m}</option>)}
          </select>
          <textarea
            value={texto} onChange={(ev) => setTexto(ev.target.value)}
            placeholder="Escribe qué tiene que corregir Cobranza. Sin este texto no se puede observar."
            style={{ ...estiloEntrada, minHeight: 70, resize: 'vertical', marginBottom: 8 }}
          />
          <p style={{ fontSize: 12, color: error ? T.rojo : T.naranjaTx, marginBottom: 8 }}>
            {error || (listoObservar ? 'Listo para observar.'
              : !motivo ? 'Falta elegir el motivo.'
              : 'Escribe al menos una indicación concreta.')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton primario disabled={!listoObservar || cargando}
                   onClick={() => enviar('observar', { motivo, texto })}>
              {cargando ? 'Guardando…' : 'Confirmar observación'}
            </Boton>
            <Boton onClick={() => setPanel(null)}>Cancelar</Boton>
          </div>
        </div>
      )}

      {panel === 'responder' && (
        <div style={{
          marginTop: 11, background: T.azulBg, border: `0.5px solid ${T.azul}`,
          borderRadius: T.rInput, padding: 12,
        }}>
          <h6 style={{
            margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: T.azul,
            textTransform: 'uppercase', letterSpacing: '.06em',
          }}>Responder — cuenta qué corregiste</h6>
          <textarea
            value={texto} onChange={(ev) => setTexto(ev.target.value)}
            placeholder="Explica qué corregiste. Si cambiaste el comprobante, dilo acá también."
            style={{ ...estiloEntrada, minHeight: 70, resize: 'vertical', marginBottom: 8 }}
          />
          {error && <p style={{ fontSize: 12, color: T.rojo, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton primario disabled={texto.trim().length < 10 || cargando}
                   onClick={() => enviar('responder', { texto })}>
              {cargando ? 'Guardando…' : 'Enviar corrección'}
            </Boton>
            <Boton onClick={() => setPanel(null)}>Cancelar</Boton>
          </div>
        </div>
      )}

      {panel === 'notaria' && (
        <div style={{
          marginTop: 11, background: T.crema, border: `0.5px solid ${T.linea2}`,
          borderRadius: T.rInput, padding: 12,
        }}>
          <Campo etiqueta="Fecha de ingreso a notaría Quintanilla">
            <input type="date" value={dia} onChange={(ev) => setDia(ev.target.value)} style={estiloEntrada} />
          </Campo>
          {error && <p style={{ fontSize: 12, color: T.rojo, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton primario disabled={!dia || cargando} onClick={() => enviar('notaria', { fecha: dia })}>
              {cargando ? 'Guardando…' : 'Registrar'}
            </Boton>
            <Boton onClick={() => setPanel(null)}>Cancelar</Boton>
          </div>
        </div>
      )}

      {panel === 'titulo' && (
        <div style={{
          marginTop: 11, background: T.crema, border: `0.5px solid ${T.linea2}`,
          borderRadius: T.rInput, padding: 12,
        }}>
          <Campo etiqueta="N° de título de SUNARP">
            <input value={valor} onChange={(ev) => setValor(ev.target.value)}
                   placeholder="2026-01984733" style={estiloEntrada} />
          </Campo>
          <Campo etiqueta="Fecha de presentación">
            <input type="date" value={dia} onChange={(ev) => setDia(ev.target.value)} style={estiloEntrada} />
          </Campo>
          <p style={{ fontSize: 12, color: T.texto2, marginBottom: 8, lineHeight: 1.5 }}>
            Al registrar el título, el reloj de GO se detiene y los días pasan a contarse como
            tiempo en registro público. Sin número de título el reloj sigue corriendo.
          </p>
          {error && <p style={{ fontSize: 12, color: T.rojo, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton primario disabled={valor.trim().length < 4 || cargando}
                   onClick={() => enviar('titulo', { titulo: valor, fecha: dia })}>
              {cargando ? 'Guardando…' : 'Registrar título'}
            </Boton>
            <Boton onClick={() => setPanel(null)}>Cancelar</Boton>
          </div>
        </div>
      )}

      {panel === 'anular' && (
        <div style={{
          marginTop: 11, background: T.rojoBg, border: `0.5px solid ${T.rojoLinea}`,
          borderRadius: T.rInput, padding: 12,
        }}>
          <h6 style={{
            margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: T.rojo,
            textTransform: 'uppercase', letterSpacing: '.06em',
          }}>Anular expediente</h6>
          <p style={{ fontSize: 12.5, color: T.texto, marginBottom: 8, lineHeight: 1.5 }}>
            El expediente no se borra: queda en la hoja como ANULADO y sale del tablero.
            Conserva su número y todo su historial.
          </p>
          <select value={motivo} onChange={(ev) => setMotivo(ev.target.value)} style={{ ...estiloEntrada, marginBottom: 8 }}>
            <option value="">Elige el motivo…</option>
            {MOTIVOS_ANULAR.map((m) => <option key={m}>{m}</option>)}
          </select>
          <textarea
            value={texto} onChange={(ev) => setTexto(ev.target.value)}
            placeholder="Explica por qué se anula. Queda en la bitácora con tu nombre."
            style={{ ...estiloEntrada, minHeight: 64, resize: 'vertical', marginBottom: 8 }}
          />
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, marginBottom: 10 }}>
            <input type="checkbox" checked={avisar} onChange={(ev) => setAvisar(ev.target.checked)} style={{ marginTop: 2 }} />
            <span>Avisar al cliente por correo. Déjalo sin marcar si es una solicitud de prueba o duplicada.</span>
          </label>
          {error && <p style={{ fontSize: 12, color: T.rojo, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton peligro disabled={!listoAnular || cargando}
                   onClick={() => enviar('anular', { motivo, texto, avisarCliente: avisar })}>
              {cargando ? 'Anulando…' : 'Anular expediente'}
            </Boton>
            <Boton onClick={() => setPanel(null)}>Cancelar</Boton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── ficha */

function Ficha({ e, indice, sesion, onListo, fotos }) {
  const [abierta, setAbierta] = useState(false);
  const color = COLOR_ESTADO[e.estado] || T.linea2;
  const [bgEstado, txEstado] = FONDO_ESTADO[e.estado] || [T.neutroBg, T.texto2];
  const [chip, chipBg, chipTx] = chipPlazo(e);

  return (
    <article style={{
      background: T.blanco, borderRadius: T.rCard,
      borderWidth: '0.5px 0.5px 0.5px 4px', borderStyle: 'solid',
      borderColor: `${T.linea} ${T.linea} ${T.linea} ${color}`,
      overflow: 'hidden', opacity: anulado(e) ? 0.72 : 1,
    }}>
      <button onClick={() => setAbierta(!abierta)} aria-expanded={abierta} style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%',
        background: 'none', border: 0, textAlign: 'left', padding: '12px 14px', cursor: 'pointer',
      }}>
        <span style={{
          flex: 'none', width: 22, height: 22, borderRadius: '50%', background: T.navy,
          color: T.blanco, fontSize: 10, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
        }}>{indice}</span>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 600, color: T.texto }}>
              {e.id}
            </span>
            <Pastilla texto={e.estado} fondo={bgEstado} color={txEstado} />
            {e.alerta && <Pastilla texto="Sin cargo de notaría" fondo={T.rojoBg} color={T.rojo} />}
            {e.vueltas > 0 && <Pastilla texto={`${e.vueltas}ª vuelta`} fondo={T.naranjaBg} color={T.naranjaTx} />}
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, color: T.texto }}>{e.nombre}</div>

          <div style={{ display: 'flex', gap: 13, flexWrap: 'wrap', fontSize: 12, color: T.texto2 }}>
            <span>DOI <b style={{ color: T.texto, fontWeight: 500 }}>{e.doi}</b></span>
            <span>Crédito <b style={{ color: T.texto, fontWeight: 500 }}>{e.credito}</b></span>
            <span style={{ fontSize: 11, border: `0.5px solid ${T.linea}`, borderRadius: 5, padding: '1px 6px' }}>
              {e.regimen === 'NUEVA' ? 'DL 1400 · SIGM' : 'Ley 28677'}
            </span>
            <span><b style={{ color: T.texto, fontWeight: 500 }}>{soles(e.monto)}</b></span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: T.texto2 }}>
            <Pastilla texto={chip} fondo={chipBg} color={chipTx} />
            <span>Responsable: <b style={{ color: T.texto, fontWeight: 500 }}>{e.responsable}</b></span>
          </div>
        </div>

        <span style={{
          color: T.texto3, fontSize: 11, marginTop: 4,
          transform: abierta ? 'rotate(180deg)' : 'none', transition: '.15s',
        }}>▼</span>
      </button>

      {abierta && (
        <div style={{
          borderTop: T.borde, background: T.crema, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <section>
            <Rotulo>Datos del expediente</Rotulo>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', fontSize: 13, margin: '8px 0 0' }}>
              <dt style={{ color: T.texto2 }}>Placa</dt><dd style={{ margin: 0 }}>{e.placa || '—'}</dd>
              <dt style={{ color: T.texto2 }}>Fecha del crédito</dt><dd style={{ margin: 0 }}>{fecha(e.fechaCredito)}</dd>
              <dt style={{ color: T.texto2 }}>Régimen</dt>
              <dd style={{ margin: 0 }}>
                {e.regimen === 'NUEVA' ? 'DL 1400 · SIGM (desde el 02.03.2025)' : 'Ley 28677 (antes del 02.03.2025)'}
              </dd>
              <dt style={{ color: T.texto2 }}>Monto</dt><dd style={{ margin: 0 }}>{soles(e.monto)}</dd>
              {e.notaria && (<>
                <dt style={{ color: T.texto2 }}>Ingreso a notaría</dt>
                <dd style={{ margin: 0 }}>{fecha(e.notaria)} · Quintanilla</dd>
              </>)}
              <dt style={{ color: T.texto2 }}>N° de título</dt><dd style={{ margin: 0 }}>{e.titulo || '—'}</dd>
              <dt style={{ color: T.texto2 }}>Vueltas</dt><dd style={{ margin: 0 }}>{e.vueltas || 0}</dd>
              {e.asesor && (<>
                <dt style={{ color: T.texto2 }}>Registrado por</dt>
                <dd style={{ margin: 0, display: 'flex', gap: 7, alignItems: 'center' }}>
                  <Avatar usuario={e.asesor} foto={fotos[e.asesor]} tam={20} />{e.asesor}
                </dd>
              </>)}
            </dl>
          </section>

          <section>
            <Rotulo>Línea de tiempo</Rotulo>
            <ul style={{
              listStyle: 'none', margin: '8px 0 0', padding: '0 0 0 17px',
              borderLeft: `2px solid ${T.linea}`, display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {hitos(e).map(([texto, cuando, tipo], i) => (
                <li key={i} style={{ position: 'relative', fontSize: 13 }}>
                  <span style={{
                    position: 'absolute', left: -24, top: 5, width: 9, height: 9, borderRadius: '50%',
                    background: tipo === 'ahora' ? T.azul : tipo === 'alerta' ? T.rojo : T.navy,
                    border: `2px solid ${T.crema}`,
                  }} />
                  <b style={{ display: 'block', fontWeight: 600, color: T.texto }}>{texto}</b>
                  {cuando && <span style={{ color: T.texto2, fontSize: 12 }}>{fechaHora(cuando)}</span>}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <Rotulo>Observaciones y respuestas</Rotulo>
            {e.comentarios && e.comentarios.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {e.comentarios.map((c, i) => (
                  <div key={i} style={{
                    background: T.blanco, border: T.borde,
                    borderLeft: `3px solid ${
                      c.tipo === 'ANULACIÓN' ? T.rojo : c.tipo === 'OBSERVACIÓN' ? T.naranja : T.azul}`,
                    borderRadius: T.rInput, padding: '9px 12px', fontSize: 13, color: T.texto,
                  }}>
                    <div style={{ fontSize: 11, color: T.texto2, marginBottom: 4, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Avatar usuario={c.usuario} foto={fotos[c.usuario]} tam={20} />
                      <b style={{ color: T.texto, fontWeight: 600 }}>{c.usuario}</b>
                      <span>{c.area}</span>
                      <span>{fechaHora(c.fecha)}</span>
                    </div>
                    {c.motivo && <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.motivo}</div>}
                    {c.texto}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: T.texto3, marginTop: 8 }}>
                Sin observaciones. Cuando Tesorería o Legal observen, el motivo aparece acá.
              </p>
            )}
          </section>

          <section>
            <Rotulo>Acciones</Rotulo>
            <div style={{ marginTop: 8 }}>
              <Acciones e={e} sesion={sesion} onListo={onListo} />
            </div>
          </section>

          {e.regimen === 'ANTIGUA' && e.estado === 'EN TRÁMITE' && !e.titulo && (
            <p style={{ fontSize: 12, color: T.texto2, lineHeight: 1.5 }}>
              El reloj sigue corriendo: se detiene únicamente cuando se registre el número de título de SUNARP.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/* ─────────────────────────────── tablero */

export default function TableroLGM({ expedientes = [], usuarios = [], actualizado, error }) {
  const router = useRouter();
  const [sesion, setSesion] = useState(null);
  const [aviso, setAviso] = useState('');
  const [rol, setRol] = useState('todos');
  const [estado, setEstado] = useState(null);
  const [regimen, setRegimen] = useState('todos');
  const [plazo, setPlazo] = useState('todos');
  const [verAnulados, setVerAnulados] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    try {
      const s = localStorage.getItem(LLAVE_SESION);
      if (s) {
        const dato = JSON.parse(s);
        setSesion(dato);
        if (ESTADOS_POR_ROL[dato.area]) setRol(dato.area);
      }
    } catch { /* sesión ilegible: se pide de nuevo */ }
  }, []);

  function trasAccion(mensaje) {
    setAviso(mensaje || 'Cambio guardado.');
    router.refresh();
    setTimeout(() => setAviso(''), 6000);
  }

  const vivos = useMemo(
    () => expedientes.filter((e) => (verAnulados ? anulado(e) : !anulado(e))),
    [expedientes, verAnulados]
  );

  const porRol = useMemo(
    () => (rol === 'todos' ? vivos : vivos.filter((e) => ESTADOS_POR_ROL[rol].includes(e.estado))),
    [vivos, rol]
  );

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return porRol.filter((e) => {
      if (estado && e.estado !== estado) return false;
      if (regimen !== 'todos' && e.regimen !== regimen.toUpperCase()) return false;
      if (plazo === 'vencido' && !vencido(e)) return false;
      if (plazo === 'hoy' && !venceHoy(e)) return false;
      if (plazo === 'notaria' && e.estado !== 'EN NOTARÍA') return false;
      if (plazo === 'congelado' && !congelado(e)) return false;
      if (q && !`${e.nombre} ${e.doi} ${e.credito} ${e.placa} ${e.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [porRol, estado, regimen, plazo, busqueda]);

  // usuario → foto, para pintar los avatares del hilo y de quién registró la solicitud
  const fotos = useMemo(() => {
    const m = {};
    usuarios.forEach((u) => { if (u.foto) m[u.usuario] = u.foto; });
    return m;
  }, [usuarios]);

  const alertados = porRol.filter((e) => e.alerta);
  const totalAnulados = expedientes.filter(anulado).length;

  return (
    <div style={{ minHeight: '100vh', background: T.crema, color: T.texto, fontSize: 14 }}>

      <header style={{ background: T.navy, color: T.blanco, padding: '15px 0 0' }}>
        <div style={{ maxWidth: 512, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>GoTrack</div>
          <div style={{ fontSize: 11, color: T.azulNav }}>Levantamiento de Garantía Mobiliaria</div>
          <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 13 }}>
            <a href={GOTRACK} style={{
              fontSize: 12, color: T.azulNav, textDecoration: 'none', textAlign: 'center', paddingBottom: 10,
            }}>
              Desembolso
            </a>
            <a href={GOTRACK + '/ventas-segunda'} style={{
              fontSize: 12, color: T.azulNav, textDecoration: 'none', textAlign: 'center', paddingBottom: 10,
            }}>
              Ventas de segunda
            </a>
            <span style={{
              fontSize: 12, color: T.blanco, fontWeight: 500, textAlign: 'center',
              paddingBottom: 10, borderBottom: `2px solid ${T.blanco}`,
            }}>Levantamiento GM</span>
          </nav>
        </div>
      </header>

      <div style={{ background: T.blanco, borderBottom: T.borde }}>
        <div style={{
          maxWidth: 512, margin: '0 auto',
          padding: '11px 16px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ textAlign: 'center' }}><Rotulo>Vista</Rotulo></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[['todos', 'Vista completa'], ['cobranza', 'Cobranza'], ['tesoreria', 'Tesorería'], ['legal', 'Legal']]
              .map(([k, txt]) => (
                <Filtro key={k} activa={rol === k} onClick={() => { setRol(k); setEstado(null); }}>{txt}</Filtro>
              ))}
          </div>
          <BarraSesion sesion={sesion} setSesion={setSesion} usuarios={usuarios} />
        </div>
      </div>

      <main style={{ maxWidth: 512, margin: '0 auto', padding: '18px 16px 60px' }}>

        {aviso && (
          <div style={{
            background: T.azulBg, border: `0.5px solid ${T.azul}`, borderRadius: T.rCard,
            padding: '11px 14px', marginBottom: 14, fontSize: 13, color: T.azul, fontWeight: 500,
          }}>{aviso}</div>
        )}

        {error && (
          <div style={{
            background: T.rojoBg, border: `0.5px solid ${T.rojoLinea}`, borderLeft: `4px solid ${T.rojo}`,
            borderRadius: T.rCard, padding: '12px 15px', marginBottom: 14,
          }}>
            <div style={{ fontWeight: 600, color: T.rojo, fontSize: 13 }}>No se pudo leer la hoja</div>
            <div style={{ fontSize: 13, marginTop: 2 }}>
              {error}. Revisa que LGM_API_URL y LGM_SECRETO coincidan con la aplicación web de Apps Script.
            </div>
          </div>
        )}

        {alertados.length > 0 && (
          <div style={{
            background: T.rojoBg, border: `0.5px solid ${T.rojoLinea}`, borderLeft: `4px solid ${T.rojo}`,
            borderRadius: T.rCard, padding: '12px 15px', marginBottom: 14,
          }}>
            <div style={{ fontWeight: 600, color: T.rojo, fontSize: 13 }}>
              {alertados.length === 1
                ? '1 expediente de Ruta B sin cargo de notaría'
                : `${alertados.length} expedientes de Ruta B sin cargo de notaría`}
            </div>
            <div style={{ fontSize: 13, marginTop: 2 }}>
              Llevan más de 2 días hábiles en trámite y Legal aún no registra la fecha de ingreso a notaría:{' '}
              {alertados.map((e) => e.id).join(', ')}.
            </div>
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10, marginBottom: 18,
        }}>
          {TARJETAS.map(([clave, rotulo, color]) => {
            const n = porRol.filter((e) => e.estado === clave).length;
            const sel = estado === clave;
            return (
              <button key={clave} onClick={() => setEstado(sel ? null : clave)} style={{
                background: T.blanco, borderRadius: T.rCard, textAlign: 'left',
                borderWidth: '0.5px 0.5px 0.5px 4px', borderStyle: 'solid',
                borderColor: `${T.linea} ${T.linea} ${T.linea} ${color}`,
                padding: '12px 14px', cursor: 'pointer',
                boxShadow: sel ? `inset 0 0 0 2px ${T.navy}` : 'none',
              }}>
                <div style={{ fontSize: 24, fontWeight: 500, color: T.navy, lineHeight: 1.15 }}>{n}</div>
                <div style={{ fontSize: 12, color: T.texto2, marginTop: 2 }}>{rotulo}</div>
              </button>
            );
          })}
        </div>

        <div style={{
          background: T.blanco, border: T.borde, borderRadius: T.rCard,
          padding: '13px 15px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 11,
        }}>
          <input
            type="search" value={busqueda} onChange={(ev) => setBusqueda(ev.target.value)}
            placeholder="Buscar por DOI, nombre, N° de crédito o placa…"
            aria-label="Buscar expedientes"
            style={{
              width: '100%', border: T.borde, background: T.crema, color: T.texto,
              borderRadius: T.rInput, padding: '9px 14px', fontSize: 13, fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Rotulo>Régimen</Rotulo>
            {[['todos', 'Todos'], ['nueva', 'DL 1400 · SIGM'], ['antigua', 'Ley 28677']].map(([k, txt]) => (
              <Filtro key={k} activa={regimen === k} onClick={() => setRegimen(k)}>{txt}</Filtro>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Rotulo>Plazo</Rotulo>
            {[['todos', 'Todos'], ['vencido', 'Vencidos'], ['hoy', 'Vencen hoy'], ['notaria', 'En notaría'], ['congelado', 'En registro público']]
              .map(([k, txt]) => (
                <Filtro key={k} activa={plazo === k} onClick={() => setPlazo(k)}>{txt}</Filtro>
              ))}
          </div>
          {totalAnulados > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Rotulo>Otros</Rotulo>
              <Filtro activa={verAnulados} onClick={() => { setVerAnulados(!verAnulados); setEstado(null); }}>
                Anulados ({totalAnulados})
              </Filtro>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          margin: '2px 2px 9px', gap: 12, flexWrap: 'wrap',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {verAnulados ? 'Anulados'
              : estado ? (TARJETAS.find((t) => t[0] === estado) || [, 'Expedientes'])[1]
              : 'Expedientes'}
          </h2>
          <span style={{ fontSize: 12, color: T.texto2 }}>
            {lista.length} {lista.length === 1 ? 'expediente' : 'expedientes'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.length === 0 ? (
            <div style={{
              background: T.blanco, border: T.borde, borderRadius: T.rCard,
              padding: '16px 18px', fontSize: 13, color: T.texto2,
            }}>
              Ningún expediente coincide con estos filtros. Quita alguno para ver más resultados.
            </div>
          ) : (
            lista.map((e, i) => (
              <Ficha key={e.id} e={e} indice={i + 1} sesion={sesion} onListo={trasAccion} fotos={fotos} />
            ))
          )}
        </div>

        <a href={FORM_COBRANZA} target="_blank" rel="noreferrer" style={{
          display: 'inline-block', marginTop: 16, background: T.navy, color: T.blanco,
          border: `0.5px solid ${T.navy}`, borderRadius: T.rInput,
          padding: '8px 14px', fontSize: 13, fontWeight: 500, textDecoration: 'none',
        }}>Registrar nueva solicitud</a>

        {actualizado && (
          <p style={{ fontSize: 11.5, color: T.texto3, marginTop: 20 }}>
            Actualizado: {fechaHora(actualizado)}
          </p>
        )}
      </main>
    </div>
  );
}
