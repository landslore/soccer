# ⚽ D20 Soccer Manager - Fútbol 11 ("Modo Chapas")

Videojuego de gestión y simulación táctica de **Fútbol 11** que combina las mecánicas de rol de mesa **D20 (D&D / Tabletop RPG)** con un tablero interactivo de **Fútbol Chapas a 60 FPS**, desplegado de forma continua en GitHub Pages.

---

## 🌟 Características Principales

- **Fútbol 11 Realista (11 vs 11)**: Plantillas completas de 18-22 jugadores, alineaciones tácticas 4-3-3 y suplentes intercambiables.
- **Sistema de Rol D20**: Atributos clásicos (`FUE`, `DES`, `CON`, `INT`, `SAB`, `CAR`), modificadores d20, tiradas enfrentadas, ventajas/desventajas tácticas, críticos (Nat 20) y pifias (Nat 1).
- **IA Táctica con Ponderación de Utilidad**: Cada futbolista evalúa en tiempo real múltiples opciones tácticas (pase en corto, pase filtrado al hueco, desborde 1vs1, centro al área, contragolpe directo o disparo a puerta).
- **Tablero "Modo Chapas" 2D a 60 FPS**:
  - Cumplimiento estricto de la **Regla 8 de la IFAB** (saque inicial con cada equipo en su mitad reglamentaria).
  - Físicas cinemáticas de carrera con aceleración, frenada e inercia (sin saltos bruscos).
  - Fuerza de repulsión elástica anti-solapamiento (distancia mínima de 34px entre chapas).
  - Porteros confinados a su área de meta.
  - Distintivos nítidos de equipo `[L]` (Local en azul y oro) y `[V]` (Visitante en carmesí y blanco).
  - Reinicio reglamentario tras cada gol.
- **Base de Datos Auténtica**: Ingesta de 9 grupos y 76 clubes reales (ECM Madrid y Primera Futgal Santa Cruz), con más de 1.500 futbolistas generados proceduralmente con estadísticas balanceadas.
- **Panel de Depuración Táctico en Vivo**: Inspección visual de las decisiones de la IA, alternativas evaluadas y tiradas de dados en tiempo real.
- **CI/CD Automatizado**: Validación continua con GitHub Actions (type-check, tests unitarios, simulación Monte Carlo de 1.000 partidos y despliegue a GitHub Pages).

---

## 📚 Documentación Técnica para Desarrolladores y Agentes de IA

| Documento | Descripción |
| :--- | :--- |
| **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** | Arquitectura limpia, desacoplamiento de capas, Hexagonal y migración a WebGL/PixiJS. |
| **[`docs/MATCH_ENGINE_D20.md`](docs/MATCH_ENGINE_D20.md)** | Mecánicas de rol d20, máquina de estados de zonas, IA táctica y calibración de balance. |
| **[`docs/CHAPAS_BOARD_AND_PHYSICS.md`](docs/CHAPAS_BOARD_AND_PHYSICS.md)** | Canvas 2D, cinemática de locomoción, repulsión anti-solapamiento y Regla 8 IFAB. |
| **[`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md)** | Manual operativo para agentes IA con invariantes inquebrantables y guías paso a paso. |

---

## 🚀 Inicio Rápido en Local

### Requisitos
- **Node.js**: v18 o superior
- **npm**: v9 o superior

### Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo con Hot Reload (Vite)
npm run dev

# 3. Comprobar tipos TypeScript estrictos
npm run type-check

# 4. Ejecutar tests unitarios (Vitest)
npm run test:run

# 5. Ejecutar simulación estadística Monte Carlo (1.000 partidos)
npm run test:balance

# 6. Compilar para producción
npm run build
```

---

## 🎲 Verificación Monte Carlo de Balanceo

Para verificar que la distribución de goles se mantiene en los estándares del Fútbol 11 real (2.5 - 3.8 goles/partido):

```bash
npm run test:balance
```

Salida esperada:
```
🎲 Iniciando verificación estadística de balanceo Monte Carlo (Fútbol 11)...
⏱️  Simulados 1000 partidos en 115 ms (8696 partidos/seg)
⚽ Promedio de goles por partido: 3.60
🏆 Victorias Local: 34.2%
🤝 Empates: 22.1%
✈️  Victorias Visitante: 43.7%
✅ Balance estadístico Monte Carlo verificado con éxito.
```

---

## 🛡️ Licencia y Propiedad
Proyecto desarrollado con Clean Architecture y TypeScript estricto. Los datos de origen en `/sources` se mantienen como fuentes de referencia de solo lectura.
