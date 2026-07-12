# DistribOS — Identidad de marca

Este directorio guarda la identidad visual de referencia del proyecto.

- `DistribOS-Identidad-Logos.html` — bundle interactivo entregado por diseño (abrir en el navegador para ver los logos, variantes y aplicaciones).
- `README.md` — resumen extraíble en texto para citar desde código.

## Paleta

| Token                | Hex        | Uso                                            |
|----------------------|------------|------------------------------------------------|
| Ink (fondo)          | `#0F0F0F`  | Background principal                           |
| Ink 2 (surface)      | `#1A1A1A`  | Superficies elevadas                           |
| Cream (texto)        | `#F5F3EF`  | Texto primario sobre fondo oscuro              |
| Amber (acento)       | `#F5A623`  | Marca / CTAs / highlights                      |
| Amber hover          | `#E8941A`  | Hover del acento                               |

Tokens ya reflejados en `app/globals.css` como CSS variables (`--color-*`).

## Logo

El símbolo es un **cuadrado oscuro redondeado (`rx≈18` sobre 100×100)** con:

1. Un **chevron** cream (`#F5F3EF`) apuntando a la derecha.
2. Una **barra vertical** amber (`#F5A623`) a la derecha del chevron.

Semánticamente: "play + pausa" → *sistema en marcha, con control*. Encapsula
la promesa de DistribOS: mantener la operación **corriendo** sin fricción, y
al mismo tiempo darle al distribuidor el **botón de pausa/control** sobre
inventario, pedidos y ventas.

Componente reusable: `components/brand/Logo.tsx`.

```tsx
import { Logo } from '@/components/brand/Logo'

<Logo size={32} />                 // solo la marca
<Logo size={24} withWordmark />    // marca + "Distrib OS"
```

## Tipografía

- Display: **Syne** (títulos, wordmark).
- Body: **DM Sans** (UI, párrafos).
- Mono: **DM Mono** (números, montos, SKUs).

## Uso

- Fondo estándar: `--color-bg` (`#0F0F0F`).
- Sobre fondos claros (impresos, pdfs), invertir: usar variante con fondo
  cream y chevron ink.
- Nunca dejar el símbolo más chico de 20px; a partir de 16px se pierde la barra.
- El amber es el único acento — evitar mezclar con otros colores fuertes.

## Cómo actualizar esta identidad

1. Reemplazar el HTML en este directorio con la nueva versión.
2. Actualizar los tokens de color en `app/globals.css` si cambia la paleta.
3. Actualizar el SVG de `components/brand/Logo.tsx` si cambia el símbolo.
4. Actualizar `app/icon.svg` y `app/apple-icon.svg` para el favicon.
5. Bumpear la sección "Marca / Identidad" en `docs/BRIEF.md`.
