# 🐍 Snake Retro — Chrome Extension

> El clásico Snake de los 90, en tu navegador. Sin instaladores, sin dependencias, sin excusas para no jugar.

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Canvas API](https://img.shields.io/badge/Canvas-API-orange?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## ¿Qué es?

Una extensión de Chrome que convierte el popup del navegador en una arcade retro. Snake clásico con estética CRT, efecto de pantalla fosforescente, sistema de niveles y récord guardado localmente. Todo construido desde cero con HTML, CSS y JavaScript puro — sin frameworks, sin librerías de UI, sin Canvas libraries.

---

## Capturas

> _(<img width="128" height="128" alt="icon128" src="https://github.com/user-attachments/assets/ebc8fa97-8cda-4cc0-ad1c-b243510df735" />)_

---

## Características

- **Efecto CRT** — scanlines y viñeta radial con CSS puro para una estética retro auténtica.
- **Animaciones fluidas** — bucle de render con `requestAnimationFrame` independiente del tick de juego.
- **Progresión de niveles** — 10 niveles de dificultad calculados con la fórmula `1 + Math.floor(score / 60)`. La velocidad del juego aumenta dinámicamente de 150ms a 55ms por tick.
- **Sistema de vidas** — Cuentas con 3 vidas por partida. Al chocar, pierdes una vida pero conservas tu nivel y puntuación.
- **Sistema de combos** — Recoger comida rápidamente (en menos de 2.8s) incrementa un multiplicador de puntos hasta llegar a ×8.
- **Power-Ups especiales** — 
  * ★ **Doble Puntos (6s):** Multiplica por 2 los puntos obtenidos.
  * ❄ **Cámara Lenta (5s):** Reduce drásticamente la velocidad de la serpiente para maniobrar mejor.
  * ◈ **Modo Fantasma (7s):** Te permite atravesar los muros y tu propia cola.
- **Obstáculos dinámicos** — Generación de muros aleatorios a partir del nivel 3.
- **Récord persistente y ranking** — Tabla de puntuaciones Top 5 con iniciales (3 letras) y récords guardados en `localStorage`.
- **Música y efectos** — Motor chiptune propio y efectos de sonido generados con Web Audio API.

---

## Instalación

### Desde el código fuente (modo desarrollador)

1. Clona o descarga este repositorio
```bash
git clone https://github.com/davidtenerife04/-snake-game.git
```

2. Abre Chrome y ve a `chrome://extensions/`

3. Activa el **Modo desarrollador** (esquina superior derecha)

4. Haz clic en **"Cargar extensión descomprimida"**

5. Selecciona la carpeta del proyecto

6. La extensión aparecerá en tu barra de herramientas — haz clic para jugar 🐍

---

## Controles y Atajos de Teclado

| Acción | Tecla / Atajo |
|---|---|
| Moverse | `↑` `↓` `←` `→` / `W` `A` `S` `D` |
| Iniciar / Reiniciar | `Enter` / `Espacio` |
| Pausar / Reanudar | `P` / `Esc` |
| Activar / Desactivar Sonido | `M` |
| Abrir la extensión rápidamente | `Alt` + `Shift` + `S` |

---

## Estructura del proyecto

```text
snake-extension/
├── manifest.json          # Configuración de la extensión Chrome (v3)
├── index.html             # UI del popup, HUD y pantallas de menú
├── snake.js               # Lógica del motor, físicas, render y audio
├── press-start-2p.woff2   # Fuente pixel-art local y optimizada (OFL)
├── OFL.txt                # Licencia de la tipografía
└── icon16.png, icon48.png, icon128.png # Iconos de la extensión
```

---

## Cómo funciona

El juego usa **dos bucles independientes**:

- **Tick de lógica** — corre con `setInterval` a una velocidad variable (comienza en 150ms y baja progresivamente hasta 55ms en el nivel 10). Mueve la serpiente, comprueba colisiones, maneja los temporizadores de los power-ups y actualiza la puntuación.
- **Bucle de render** — corre con `requestAnimationFrame` a ~60fps. Redibuja el canvas en cada frame para que animaciones, como el pulso de la comida, las partículas y los textos flotantes, sean completamente fluidas independientemente de la velocidad de la serpiente.

---

## Sistema de puntuación

| Evento | Puntos |
|---|---|
| Comida Normal | +10 × Nivel (× Combo) (× PowerUp) |
| Comida de Hielo | +15 × Nivel (× Combo) (× PowerUp) |
| Comida Fantasma | +20 × Nivel (× Combo) (× PowerUp) |
| Comida Dorada | +25 × Nivel (× Combo) (× PowerUp) |
| Subir de nivel | Cada 60 puntos acumulados |
| Multiplicador Combo Max | ×8 (tiempo límite de 2.8s) |

---

## Posibles mejoras

- [x] Publicar en la Chrome Web Store
- [x] Modo oscuro / diferentes paletas de color
- [x] Obstáculos en niveles altos
- [x] Tabla de puntuaciones con iniciales
- [x] Sonidos 8-bit con Web Audio API

---

## Licencia

MIT — libre para usar, modificar y distribuir.

---

*Construido porque a veces lo mejor que puedes hacer con una nueva tab es jugar al Snake.*