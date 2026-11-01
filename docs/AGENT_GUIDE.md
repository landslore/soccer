# Guía de Operación para Agentes de IA (`AGENT_GUIDE.md`)

Este manual está redactado específicamente para **agentes de IA autónomos (Antigravity, Gemini, Claude, Cursor, Copilot, etc.)** que deban mantener, ampliar o corregir el código de este repositorio.

---

## 1. Mandamientos e Invariantes del Proyecto

Cualquier cambio que realices **DEBE** respetar estrictamente los siguientes principios:

### 🚨 Invariante 1: Aislamiento Absoluto de `/sources`
- El directorio `/Users/israelvinualeslopez/sources` es **de solo lectura**.
- **PROHIBIDO** editar, crear o borrar archivos dentro de `/Users/israelvinualeslopez/sources`.
- Cualquier cambio en la ingesta se hace en `scripts/import-sources-data.ts`, que genera `src/data/league-data.json`.

### 🚨 Invariante 2: Pureza de la Capa de Dominio (`src/domain/`)
- Los ficheros en `src/domain/` son TypeScript agnóstico de UI.
- **PROHIBIDO** importar React, ReactDOM, Canvas, Zustand, Tailwind o CSS en `src/domain/`.
- El motor debe poder ejecutarse en Node.js puro (`tsx scripts/verify-balance.ts`).

### 🚨 Invariante 3: Regla 8 de la IFAB (Posiciones Iniciales en Mitad Propia)
- En el saque inicial y tras gol, **los 11 jugadores del Local deben tener $y \ge 0.50$** y **los 11 del Visitante $y \le 0.50$**.
- Ningún jugador de campo puede spawnear detrás de la línea defensiva contraria.

### 🚨 Invariante 4: Balance Estadístico Monte Carlo
- El Fútbol 11 debe reflejar marcadores realistas (promedio de **2.5 a 3.8 goles por partido**).
- Tras cualquier cambio en fórmulas d20 o tácticas, **DEBES ejecutar `npm run test:balance`**. Si el promedio de goles supera 4.2 o cae de 2.0, el balance está roto y debes recalibrar los bonos defensivos en `match-engine.ts`.

### 🚨 Invariante 5: Confinamiento de Porteros
- Los porteros nunca deben participar en la construcción de campo abierto (`excludeGK = true`).
- Sus coordenadas en el canvas están clampadas a su respectiva área de meta.

---

## 2. Batería de Comandos de Verificación Obligatoria

Antes de dar por concluida cualquier tarea, ejecuta en tu terminal:

```bash
# 1. Comprobación de tipos TypeScript estrictos (0 errores)
npm run type-check

# 2. Tests unitarios del motor d20 (Vitest)
npm run test:run

# 3. Verificación de balance estadístico Monte Carlo (1000 partidos)
npm run test:balance

# 4. Build de producción completo
npm run build
```

Si alguno de estos comandos falla, el pipeline de CI (`.github/workflows/deploy.yml`) abortará el despliegue a GitHub Pages. Corrige el fallo antes de hacer commit.

---

## 3. Guías Paso a Paso para Tareas Comunes

### Tarea A: Añadir una Nueva Táctica o Formación (ej. 4-4-2)

1. **Actualizar el tipo en `src/domain/types.ts`**:
   ```typescript
   export type TacticalFormation = '4-3-3' | '4-4-2' | '3-5-2';
   ```
2. **Actualizar `getDefaultLineup` en `src/domain/procedural-roster.ts`**:
   Añade las 11 posiciones ordenadas para la nueva formación.
3. **Añadir coordenadas de saque en `src/presentation/components/ChapasBoard.tsx`**:
   Configura las posiciones de saque inicial respetando $y \ge 0.51$ (Local) y $y \le 0.49$ (Visitante).
4. **Actualizar `src/presentation/components/TacticsBoard.tsx`**:
   Añade el botón de cambio de formación en el panel táctico.

---

### Tarea B: Añadir un Nuevo Rasgo d20 (*Trait*) a los Jugadores

1. **Registrar el rasgo en `src/domain/types.ts`**:
   ```typescript
   export type PlayerTrait = 
     | 'POACHER' 
     | 'EXPLOSIVE_WINGER' 
     | 'AERIAL_TOWER' 
     | 'MAESTRO' 
     | 'IRON_LUNG'; // Nuevo rasgo
   ```
2. **Asignar el rasgo en `src/domain/procedural-roster.ts`**:
   Añade la lógica de probabilidad según la posición del jugador.
3. **Implementar el modificador en `src/domain/match-engine.ts`**:
   Aplica bonos en tiradas d20 o ventaja cuando la condición se cumpla:
   ```typescript
   const advantage = player.traits.includes('IRON_LUNG') && min >= 75;
   ```
4. **Verificar balance con `npm run test:balance`**.

---

### Tarea C: Conectar un Motor Gráfico Alternativo (WebGL / PixiJS / Phaser)

1. **No modifiques `src/domain/match-engine.ts`**: El motor ya emite el stream de eventos `MatchEvent`.
2. **Crea un nuevo componente**: P. ej. `src/presentation/components/PixiPitch.tsx`.
3. **Consume el stream**: Lee `currentMatch.lastEvent` del store Zustand (`game-store.ts`).
4. **Mapea los eventos a sprites animados**:
   - `PASS_COMPLETED` → Lerp de la textura del balón entre jugador A y B.
   - `GOAL` → Animación de disparo a red y celebración.
   - `SHOT_SAVED` → Animación de estirada del guardameta.

---

## 4. El Depurador Táctico (`DecisionDebugger.tsx`)

Durante el partido, la interfaz cuenta con un panel de depuración en tiempo real (`src/presentation/components/DecisionDebugger.tsx`):
- Muestra el jugador que tomó la decisión activa.
- Lista todas las opciones tácticas evaluadas con sus puntuaciones de utilidad ($0 - 100$).
- Detalla la tirada D20 enfrentada ($1d20 + \text{mod}$) y si hubo críticos o ventajas.
- Si necesitas diagnosticar decisiones anómalas de la IA, abre este panel en la esquina superior derecha del campo.
