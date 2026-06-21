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

- **Efecto CRT** — scanlines y viñeta radial con CSS puro para una estética retro auténtica
- **Animaciones fluidas** — bucle de render con `requestAnimationFrame` independiente del tick de juego
- **Sistema de niveles** — 10 niveles de dificultad; la velocidad aumenta cada 50 puntos
- **Récord persistente** — guardado en `localStorage`, sobrevive al cierre del navegador
- **Comida animada** — pulso sinusoidal en tiempo real con glow y highlight interno
- **Serpiente con degradado** — la cabeza brilla más que la cola, con ojos que miran en la dirección de movimiento
- **Soporte táctil** — swipe para cambiar de dirección en dispositivos móviles, con D-pad y botón de pausa dedicados
- **Pausa** — tecla `P` en cualquier momento (o botón ⏸ en móvil)
- **3 temas de color** — clásico (verde), ámbar y cyberpunk, persistidos en `localStorage`
- **Tabla de puntuaciones top 5** — con iniciales de 3 letras, guardada en `localStorage`
- **Cola de inputs** — los giros rápidos de dirección no se pierden entre ticks de juego

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

## Controles

| Acción | Tecla |
|---|---|
| Mover arriba | `↑` / `W` |
| Mover abajo | `↓` / `S` |
| Mover izquierda | `←` / `A` |
| Mover derecha | `→` / `D` |
| Pausar / reanudar | `P` |
| Móvil | Swipe en cualquier dirección |

---

## Estructura del proyecto

```
snake-extension/
├── manifest.json       # Configuración de la extensión Chrome
├── index.html          # Popup de la extensión (UI + estilos CRT)
└── snake.js            # Lógica del juego (motor, físicas, render, controles)
```

### `index.html`
Contiene toda la interfaz: el canvas de juego, el HUD (puntos, récord, nivel) y las pantallas de inicio, pausa y game over. El efecto CRT se implementa con dos pseudo-elementos CSS (`::before` y `::after`) que aplican scanlines y viñeta radial sin tocar el canvas.

### `snake.js`
Motor completo del juego. Separa el bucle de lógica (`setInterval` a velocidad variable) del bucle de render (`requestAnimationFrame` a 60fps), lo que permite que la comida pulse suavemente incluso cuando la serpiente no se ha movido. Incluye detección de colisiones, sistema de niveles, controles de teclado y swipe táctil.

---

## Cómo funciona

El juego usa **dos bucles independientes**:

- **Tick de lógica** — corre con `setInterval` a una velocidad que va de 150ms (nivel 1) hasta 60ms (nivel 10). Mueve la serpiente, comprueba colisiones y actualiza la puntuación.
- **Bucle de render** — corre con `requestAnimationFrame` a ~60fps. Redibuja el canvas en cada frame para que animaciones como el pulso de la comida sean fluidas independientemente de la velocidad del juego.

La serpiente se dibuja con degradado de color (cabeza en verde neón, cola más oscura) y la cabeza incluye dos ojos que rotan según la dirección de movimiento.

---

## Sistema de puntuación

| Evento | Puntos |
|---|---|
| Comer (nivel 1) | +10 |
| Comer (nivel N) | +10 × N |
| Subir de nivel | cada 50 puntos acumulados |
| Niveles máximos | 10 |

El récord se guarda automáticamente en `localStorage` bajo la clave `snakeBest`.

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