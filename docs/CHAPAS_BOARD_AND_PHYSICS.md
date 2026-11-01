# Tablero de Chapas 2D, Físicas y Reglas IFAB (`ChapasBoard.tsx`)

Este documento documenta la capa de presentación visual interactiva, las físicas cinemáticas y la estricta aplicación del reglamento de fútbol.

---

## 1. Dimensiones del Terreno y Coordenadas Relativas

El canvas utiliza una resolución de renderizado de **560 x 800 píxeles**:

- **Portería Norte (Visitante defiende, Local ataca)**: $y = 22\text{ px}$.
- **Línea de Mediocampo**: $y = 400\text{ px}$ ($y = 0.50$).
- **Círculo Central**: Centro en $(280, 400)$, radio $45\text{ px}$.
- **Portería Sur (Local defiende, Visitante ataca)**: $y = 778\text{ px}$ ($y = \text{height} - 22$).

```
            [ Portería Norte - Visitante ]  y = 22
   -------------------------------------------------  y = 24 (Línea de fondo)
   |                                               |
   |           ÁREA VISITANTE                      |
   |                                               |
   |      CAMPO VISITANTE (y <= 0.49)              |
   |                                               |
   ==================== y = 0.50 =================== (Línea de Mediocampo)
   |                                               |
   |      CAMPO LOCAL (y >= 0.51)                  |
   |                                               |
   |           ÁREA LOCAL                          |
   |                                               |
   -------------------------------------------------  y = 776 (Línea de fondo)
            [ Portería Sur - Local ]       y = 778
```

---

## 2. Cumplimiento Estricto de la Regla 8 de la IFAB (Saque Inicial)

> **Regla 8 de la IFAB**: "Al saque de centro, todos los jugadores, excepto el ejecutor del saque, deben encontrarse en su propia mitad del terreno de juego".

### 2.1. Formación 4-3-3 del Local (Mitad Sur, $y \ge 0.51$)
| Posición | Coordenada $x$ Relativa | Coordenada $y$ Relativa |
| :--- | :---: | :---: |
| **GK** | 0.50 | 0.92 (Bajo palos portería sur) |
| **LB** | 0.16 | 0.81 |
| **CB** | 0.38 | 0.82 |
| **CB** | 0.62 | 0.82 |
| **RB** | 0.84 | 0.81 |
| **CDM** | 0.50 | 0.70 |
| **CM** | 0.30 | 0.61 |
| **CAM** | 0.70 | 0.61 |
| **LW** | 0.20 | 0.53 |
| **ST** | 0.50 | 0.51 (Borde del círculo central) |
| **RW** | 0.80 | 0.53 |

### 2.2. Formación 4-3-3 del Visitante (Mitad Norte, $y \le 0.49$)
| Posición | Coordenada $x$ Relativa | Coordenada $y$ Relativa |
| :--- | :---: | :---: |
| **GK** | 0.50 | 0.08 (Bajo palos portería norte) |
| **LB** | 0.84 | 0.19 |
| **CB** | 0.62 | 0.18 |
| **CB** | 0.38 | 0.18 |
| **RB** | 0.16 | 0.19 |
| **CDM** | 0.50 | 0.30 |
| **CM** | 0.70 | 0.39 |
| **CAM** | 0.30 | 0.39 |
| **LW** | 0.80 | 0.47 |
| **ST** | 0.50 | 0.49 (Borde del círculo central) |
| **RW** | 0.20 | 0.47 |

---

## 3. Modelo Físico a 60 FPS: Locomoción Suave y Anti-Solapamiento

En `ChapasBoard.tsx`, las fichas se actualizan mediante un `requestAnimationFrame` que simula la cinemática de los futbolistas:

### 3.1. Aceleración e Inercia de Carrera (Sin Saltos Bruscos)
En lugar de una interpolación lineal instantánea (`lerp`), cada chapa posee vector velocidad $(\mathbf{v}_x, \mathbf{v}_y)$:
- La aceleración se adapta a la distancia del objetivo: $\text{desiredSpeed} = \min(\text{maxSpeed}, \text{dist} \times 0.15)$.
- Amortiguación e inercia: $\mathbf{v} \leftarrow \mathbf{v} + (\mathbf{v}_{\text{desired}} - \mathbf{v}) \times 0.16$.
- Zancada con bamboleo natural perpendicular a la carrera: $\text{stride} = \sin(\text{runCycle}) \times 1.4$.

### 3.2. Fuerza Elástica Anti-Solapamiento (Algoritmo Boids / Reynolds)
Para evitar que dos chapas se superpongan en el área o centro del campo:
- **Radio de separación mínima**: $34\text{ px}$ (15px radio A + 15px radio B + 4px de margen).
- Si la distancia euclídea $d < 34\text{ px}$:
  $$\text{overlap} = (34 - d) \times 0.5$$
  Se aplica un impulso de repulsión elástico en direcciones opuestas normalizadas.

### 3.3. Confinamiento del Guardameta
Los porteros no abandonan su área:
- **Portero Local**: $y \in [0.86 \times \text{height}, 0.94 \times \text{height}]$, $x \in [0.40 \times \text{width}, 0.60 \times \text{width}]$.
- **Portero Visitante**: $y \in [0.06 \times \text{height}, 0.14 \times \text{height}]$, $x \in [0.40 \times \text{width}, 0.60 \times \text{width}]$.

---

## 4. Animación de Eventos Clave

### 4.1. Gol (`GOAL`) y Reinicio Reglamentario
1. El balón viaja a la escuadra de la portería rival ($y = 22$ si marca Local, $y = 778$ si marca Visitante).
2. Se disparan partículas de confeti de celebración.
3. **Reinicio tras 1.2 segundos**:
   - Todas las 22 chapas regresan suavemente a sus bases reglamentarias (`baseX`, `baseY`) en sus respectivas mitades.
   - El esférico vuelve al punto central $(280, 400)$.
   - El delantero centro del equipo que encajó el gol se coloca junto al balón para el saque de centro.

### 4.2. Parada del Guardameta (`SHOT_SAVED`)
- El balón viaja hacia la estirada del guardameta dentro de su arco.
- El portero retiene el esférico (`gk.hasBall = true`) y el delantero no se queda con el balón.

---

## 5. Distinción Visual Nítida de Equipos

Para eliminar cualquier confusión cuando dos jugadores generados proceduralmente comparten nombre de pila (p. ej. *Leo* o *Alex*):
- **Cápsula de Nombre Local**: Fondo azul profundo `rgba(0, 60, 150, 0.92)` con reborde dorado y etiqueta `[L] Leo (ST)`.
- **Cápsula de Nombre Visitante**: Fondo carmesí `rgba(180, 25, 25, 0.92)` con reborde blanco y etiqueta `[V] Leo (ST)`.
