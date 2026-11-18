# Simón Dice — Arcade de Memoria

Juego web interactivo estilo arcade moderno en modo oscuro (**Dark Mode**), desarrollado con **React**, **TypeScript**, **Tailwind CSS** y **Vite**, con audio sintetizado en tiempo real mediante **Web Audio API**.

## Características

- **4 botones neón** en disposición circular arcade: **Verde**, **Rojo**, **Amarillo** y **Azul** con efectos luminosos al activarse o presionarse.
- **Audio sintetizado con Web Audio API** (sin archivos externos): cada color reproduce una nota musical distinta, además de efectos para ronda superada y error.
- **Secuencia progresiva**: cada nivel añade un nuevo color aleatorio a la secuencia y aumenta sutilmente el ritmo.
- **Marcador en tiempo real**: muestra el **Nivel / Puntaje actual** y guarda el **Récord máximo** en `localStorage`.
- **Pantalla de Fin del juego**: incluye vibración visual en el tablero, muestra qué color correspondía y ofrece un botón grande de **Jugar de nuevo**.
- **Atajos de teclado y diseño móvil**: compatible con pantalla táctil en celulares y teclas `1`, `2`, `3`, `4` (o `Q`, `W`, `A`, `S`) en computadora.

## Requisitos previos

- [Node.js](https://nodejs.org/) (v18 o superior)
- `npm` (incluido con Node.js)

## Instalación y ejecución local

1. Instala las dependencias:

```bash
npm install
```

2. Inicia el servidor de desarrollo:

```bash
npm run dev
```

3. Abre tu navegador en `http://localhost:3000`.

## Compilación para producción

```bash
npm run build
npm run preview
```
# Memorisador-de-luces
