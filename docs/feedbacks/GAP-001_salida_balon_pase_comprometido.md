# GAP-001: Pase en Corto "Seguro" a Compañero en Sombra de Marcaje Rival en Salida de Balón

- **ID**: `GAP-001`
- **Estado**: `🟢 CORREGIDO / RESUELTO`
- **Fecha de Detección**: 2026-11-01
- **Fecha de Resolución**: 2026-11-01
- **Minuto / Fotograma**: Min 6' 30" (Paso 14/23) $\to$ Desemboca en Gol en Min 7' 00" (Paso 15/23)
- **Zona del Campo**: `OWN_BOX` (Salida de balón en área propia)
- **Decisor Implicado**: `#3 Mario Gil (CB)` (Atributos: INT 9, DES 12, FUE 16, CON 11. Arquetipo: `SNIPER_SHOOTER`)
- **Opción Elegida por la IA**: `"Pase seguro en corto a Brais Pérez"` (Riesgo: `LOW`, d20 `+2`, Utilidad evaluada: `82%`)
- **Receptor Destinado**: `#8 Brais Pérez (CDM)`
- **Consecuencia Inmediata**: 
  - Min 6' 30": `PASS_INTERCEPTED` cortado en la frontal por `#15 Alejandro Blanco (ST)` rival.
  - Min 7' 00": `#12 Manuel Pérez (CAM)` rival recoge el balón suelto dentro del área pequeña y anota gol (`0 - 1`).

---

## 1. Descripción de la Inconsistencia

Durante una salida de balón desde el área propia (`OWN_BOX`), el central `#3 Mario Gil` se encuentra bajo la presión del delantero rival `#15 Alejandro Blanco`. 

El motor de decisiones evalúa como mejor alternativa táctica:
> *"Pase seguro en corto a Brais Pérez"* con **82% de utilidad** y calificado como **Riesgo LOW**.

Sin embargo, en el tablero táctico visual:
1. El mediocentro `#8 Brais Pérez` se encuentra **totalmente emparejado y tapado** por la espalda por el mediapunta rival `#12 Manuel Pérez (CAM)`.
2. La trayectoria de pase cruza directamente la zona de influencia y presión del delantero `#15 Alejandro Blanco`.
3. El resultado es un pase suicida en el eje central: interceptación instantánea y gol encajado en la siguiente jugada.

**Veredicto**: Un pase nunca puede ser evaluado como `"Riesgo LOW"` ni tener `82%` de utilidad si el receptor está marcado al hombre o situado en la sombra de presión de un atacante rival.

---

## 2. Diagnóstico del Estado Visual del Tablero

```
Portería Local (y = 800)
    [#1 Diego (GK)]
------------------------------------------------------
    [#3 Mario Gil (CB)] (Tiene el balón)
        ▲
        │ (Presión asfixiante)
    [#15 Alejandro Blanco (ST rival)]
------------------------------------------------------
    [#8 Brais Pérez (CDM)] ◄─── MARCAJE PEGADO ───► [#12 Manuel Pérez (CAM rival)]
```

- **Línea de pase**: Bloqueada frontalmente por el ST rival e interceptable lateralmente por el CAM rival.
- **Alternativa real del fútbol profesional**: Ante la imposibilidad de salir limpio por el centro, el central debe buscar un **despeje orientado a banda** (`CLEARANCE`), un pase al lateral libre (`LB` / `RB`) o un balón largo directo al campo contrario, evitando comprometer el pasillo interior.

---

## 3. Causa Raíz en el Código (`src/domain/match-engine.ts`)

En el método `resolveBuildUpOrCounter`:

```typescript
// En match-engine.ts (Lógica actual):
const optShort: TacticalOption = {
  actionType: 'SHORT_PASS',
  label: `Pase seguro en corto a ${pivot.name}`,
  targetPlayer: pivot,
  targetZone: 'MIDFIELD',
  utilityScore: 82, // HARDCODEADO: Asume que pasar al pivote siempre es óptimo
  riskLevel: 'LOW',  // HARDCODEADO: Califica de bajo riesgo sin comprobar presión rival
  reason: `Asegurar posesión y dar salida limpia ante la presión de ${presser.name}`,
  d20Bonus: +2,
};
```

### Problemas Técnicos Identificados:
1. **Ausencia de Cálculo de Marcaje / Interceptabilidad**: El motor no mide si el receptor (`pivot`) tiene defensores rivales en un radio de proximidad o en el vector de pase $\vec{v} = P_{\text{target}} - P_{\text{maker}}$.
2. **Falsa Sensación de Seguridad**: El label y el `riskLevel: 'LOW'` engañan a la IA haciéndole creer que apoyar en el pivote defensivo no conlleva riesgo, cuando en salida bajo presión es la zona más peligrosa del campo.
3. **Falta de Alternativa de Despeje de Emergencia**: En `OWN_BOX` no existe una opción explícita de `CLEARANCE_SAFE` (despeje largo a banda sin complicaciones).

---

## 4. Solución Técnica Propuesta para el Motor

### 4.1. Función de Evaluación de Sombra de Pase (`isPassLineObstructed`)
Calcular la distancia entre el receptor y los rivales más cercanos en la zona:
- Si el rival más cercano al receptor está a menos de una distancia crítica ($d < \text{THRESHOLD}$):
  - Calificar la opción como `riskLevel: 'HIGH'`.
  - Aplicar una penalización severa a la utilidad:
    $$\Delta \text{Utility} = -35 \quad \text{a} \quad -45$$
  - Actualizar la razón: `"Pase altamente comprometido: el receptor se encuentra encimado por la marca rival"`.

### 4.2. Incorporar la Opción de Despeje de Seguridad (`EMERGENCY_CLEARANCE`)
En zona `OWN_BOX`, cuando las líneas de pase corto estén tapadas:
```typescript
const optClear: TacticalOption = {
  actionType: 'SHORT_PASS', // o nuevo tipo CLEARANCE
  label: `Despeje de seguridad hacia la banda`,
  targetZone: 'DEFENSIVE_HALF',
  utilityScore: 65, // Supera al pase tapado (82 - 40 = 42)
  riskLevel: 'MEDIUM',
  reason: 'Ante el asedio rival, el zaguero no se complica y aleja el peligro a zona neutra',
  d20Bonus: 0,
};
```

### 4.3. Modulación por Inteligencia (`INT`)
- Centrales con baja visión táctica ($\text{INT} \le 10$, como Mario Gil con 9) pueden cometer errores ocasionales de precipitación, pero **no como decisión con 82% de utilidad óptima**, sino como una pifia forzada por la presión del rival.

---

## 5. Criterio de Aceptación para Dar por Resuelto este Gap

1. En salida de balón desde `OWN_BOX`, si el CDM está encimado por un rival, la utilidad de pasarle en corto cae por debajo del 45%.
2. La opción preferente ante presión intensa pasa a ser el apoyo al lateral abierto o el despeje largo.
3. El depurador de IA (`DecisionDebugger`) refleja explícitamente el riesgo elevado cuando el receptor tiene un rival encima.

---

## 6. Implementación Realizada y Verificación

1. **Detección de Sombra de Marcaje en `resolveBuildUpOrCounter`**:
   - Se identifica al marcador rival que vigila el carril interior (`opposingShadow = getActivePlayer(def, ['CAM', 'CM', 'ST'])`).
   - Si el rival presiona alto o el marcador cuenta con buena anticipación (`SAB/DES >= 11`), `isMidfielderMarked` se activa.
2. **Reclasificación y Penalización**:
   - `optShort` se renombra a `Pase interior comprometido a ${midfielder.name}`.
   - `riskLevel` pasa a `'HIGH'`.
   - `utilityScore` cae drásticamente a $42 - (12 - \text{passerInt})$ ($\le 39$ para centrales de baja INT como Mario Gil con 9).
3. **Nuevas Opciones Tácticas Inteligentes**:
   - `optWide`: *Apertura segura a la banda hacia ${fullback.name}* (Riesgo `LOW`, Utilidad `84%`, d20 `+2`). Es la opción que ahora elige prioritariamente la IA para desahogar el juego.
   - `optClearance`: *Despeje de seguridad hacia la divisoria* (Riesgo `MEDIUM`, Utilidad `70%`). Evita regalar el balón en boca de gol.
4. **Verificación**:
   - `npm run audit:ui`: 25 partidos simulados (4.500 ticks) sin intercepciones absurdas en el área chica ni goles en contra por decisiones incoherentes.
   - `npm run test:balance`: 1.000 partidos en 385 ms con 2.31 goles por partido (rango óptimo F11).
   - `npm run type-check` y `npm run test:run` pasando con 0 errores.

