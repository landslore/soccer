# Registro de Gaps de Decisión IA y Feedbacks Tácticos (`docs/feedbacks/`)

Este directorio documenta de forma sistemática y auditable todos los **gaps tácticos, inconsistencias visuales y decisiones erróneas de la IA** detectadas durante los partidos en el simulador.

Cualquier agente que trabaje en el motor de decisiones (`src/domain/match-engine.ts`) debe consultar este registro para entender los casos límite (*edge cases*) que degradan el realismo del juego y abordarlos de acuerdo a las soluciones técnicas propuestas.

---

## 📋 Índice de Gaps y Estado de Resolución

| ID | Fecha | Minuto/Contexto | Descripción Corta | Estado | Archivo de Detalle |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **GAP-001** | 2026-11-01 | Min 6' 30" (`OWN_BOX`) | Central efectúa "pase seguro" a mediocentro que está totalmente tapado en sombra de pase | 🟡 PENDIENTE | [`GAP-001_salida_balon_pase_comprometido.md`](./GAP-001_salida_balon_pase_comprometido.md) |

---

## 📐 Plantilla Estándar para Nuevos Reportes

Para registrar un nuevo gap detectado, crea un archivo con el formato `GAP-XXX_nombre_descriptivo.md` siguiendo esta estructura:

```markdown
# GAP-XXX: [Título Descriptivo del Error Táctico]

- **Fecha**: AAAA-MM-DD
- **Minuto / Fotograma**: Min X' XX" (Paso Y/Z)
- **Zona del Campo**: `OWN_BOX` | `DEFENSIVE_HALF` | `MIDFIELD` | `ATTACKING_THIRD` | `OPPONENT_BOX`
- **Decisor Implicado**: #[Dorsal] [Nombre] ([Posición], [Arquetipo Personalidad])
- **Opción Elegida por la IA**: "[Etiqueta]" (Utilidad: X%, Riesgo: LOW/MED/HIGH)
- **Consecuencia Inmediata**: [Pérdida / Gol rival / Contragolpe / Pase al vacío]

## 1. Descripción de la Inconsistencia
[Explicación clara de por qué la decisión de la IA es tácticamente absurda o visualmente contradictoria con el estado del campo].

## 2. Diagnóstico del Estado Visual del Tablero
[Detalle de dónde estaban los compañeros y los rivales interponiéndose].

## 3. Causa Raíz en el Código (`src/domain/match-engine.ts`)
[Identificación exacta del método y de la fórmula que asignó una utilidad errónea].

## 4. Solución Técnica Propuesta
[Cambios específicos a implementar en el motor: penalización de utilidad, cálculo de sombra de marcaje, nueva opción táctica, etc.].
```
