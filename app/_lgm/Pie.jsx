// Pie de página. Va en su propio archivo, y no dentro del tablero, porque el
// resto de GoTrack tiene el mismo pie: cuando haya acceso a ese repositorio,
// este componente se reemplaza por el de allá —o se mueve a un paquete común—
// y los datos de registro quedan en un solo sitio. Mientras tanto, al menos
// están en un solo sitio DENTRO de esta ruta.
//
// Que falte acá y esté en el resto de GoTrack es, en la parte de la Ley 29733,
// una omisión: los registros de bancos de datos personales ante la ANPD tienen
// que estar visibles, y el aviso de confidencialidad tiene que poder leerse
// ANTES de identificarse. Por eso el pie no depende de la sesión.

import { T } from './tokens';

// Códigos de registro reales. Los dos RUC tienen once dígitos — si alguna vez
// queda uno con diez o con doce, está mal copiado.
const BANCOS = [
  {
    entidad: 'Global Go S.A.C.',
    codigo: 'PJ-2026-2079',
    constancia: 'INS-2026-2295',
    ruc: '20611596155',
  },
  {
    entidad: 'Coop. de Ahorro y Crédito Promotora de Negocios y Servicios',
    codigo: 'PJ-2026-2095',
    constancia: 'INS-2026-2312',
    ruc: '20523897048',
  },
];

export default function Pie() {
  return (
    <footer style={{
      borderTop: `0.5px solid ${T.linea}`,
      background: T.crema,
      padding: '26px 16px 34px',
    }}>
      <div style={{
        maxWidth: 512, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center',
      }}>

        {/* Tres líneas en jerarquía descendente. La tercera es quechua y va
            exactamente así: sin tildes y sin reordenar las palabras. El lang
            está para que un lector de pantalla no la lea como castellano. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: T.navy, letterSpacing: '.14em',
          }}>POWERED BY LEGAL TEAM GO</div>
          <div style={{
            fontSize: 11, color: T.texto2, letterSpacing: '.10em',
          }}>IMPULSADO POR EL EQUIPO LEGAL DE GO</div>
          <div lang="qu" style={{
            fontSize: 10, color: T.texto3, letterSpacing: '.08em',
          }}>GO EQUIPO LEGAL IMAYNA RUWASQAN</div>
        </div>

        {/* Bancos de datos personales. Una tarjeta por entidad, armadas desde
            los datos de arriba: dos bloques de marcado copiados serían dos
            sitios donde corregir un dígito. */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: T.texto3,
            letterSpacing: '.10em', textTransform: 'uppercase',
          }}>Bancos de datos personales · ANPD · Ley 29733</div>

          {/* Una sola columna a propósito: en dos, la línea de códigos se
              parte en tres renglones y los números dejan de leerse de un tirón. */}
          {BANCOS.map((b) => (
            <div key={b.ruc} style={{
              background: T.blanco, border: `0.5px solid ${T.linea}`,
              borderRadius: T.rInput, padding: '10px 13px',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.texto, lineHeight: 1.35 }}>
                {b.entidad}
              </div>
              {/* Cada código con su rótulo en un nowrap propio: en un teléfono
                  la línea entera no cabe, y al partirse dejaba «RUC» al final
                  de un renglón y el número al principio del siguiente. Son
                  datos que alguien va a transcribir dígito por dígito ante la
                  ANPD, así que cada uno se mueve entero o no se mueve. */}
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 11, color: T.texto2,
                marginTop: 3, lineHeight: 1.6,
              }}>
                {[`Cód. ${b.codigo}`, `Constancia ${b.constancia}`, `RUC ${b.ruc}`]
                  .map((trozo, i) => (
                    <span key={trozo}>
                      {/* El separador va FUERA del nowrap, y esa es la parte que
                          importa: si va dentro, no queda ni un espacio partible
                          entre las tres unidades, el navegador no tiene dónde
                          cortar y el RUC se sale de la tarjeta. El espacio duro
                          antes del punto lo deja pegado a la unidad anterior; el
                          espacio normal de después es el único punto de corte. */}
                      {i > 0 && <span style={{ color: T.linea2 }}>{' · '}</span>}
                      <span style={{ whiteSpace: 'nowrap' }}>{trozo}</span>
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </section>

        <p style={{
          fontSize: 10.5, color: T.texto3, lineHeight: 1.6, margin: 0, textAlign: 'left',
        }}>
          La información contenida en esta plataforma es de carácter confidencial y de uso
          exclusivo del personal autorizado de Global Go S.A.C. y de la Cooperativa de Ahorro
          y Crédito Promotora de Negocios y Servicios. Su acceso, reproducción o divulgación
          no autorizada está prohibida.
        </p>

        <div style={{
          borderTop: `0.5px solid ${T.linea}`, paddingTop: 14,
          display: 'flex', flexDirection: 'column', gap: 2,
          fontSize: 11, color: T.texto3, lineHeight: 1.55,
        }}>
          <div>© 2026 Global Go S.A.C. · Todos los derechos reservados</div>
          <div>Desarrollado por Fernando Barzola y Juan Carlos Barrientos</div>
          <div>Desarrollado con asistencia de Claude</div>
          <div>
            <a
              href="https://claude.ai" target="_blank" rel="noopener noreferrer"
              style={{ color: T.texto2, textDecoration: 'underline' }}
            >claude.ai</a>
            {' · Anthropic'}
          </div>
        </div>

      </div>
    </footer>
  );
}
