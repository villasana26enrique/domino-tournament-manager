# Guía de Licencias Pro Offline (`LICENSING.md`)

> **Estado actual:** La monetización Pro está **pausada temporalmente** mediante el interruptor `PRO_MONETIZATION_ENABLED = false` en `src/infrastructure/commercial-config.ts`. Todos los usuarios pueden registrar jugadores sin límite y usar la tarjeta PNG de WhatsApp sin bloqueos. Cuando tengas un flujo automático de cobro, cambia ese valor a `true` para reactivar el sistema Pro al instante.

Esta guía explica cómo generar claves Pro firmadas con **Ed25519** desde tu Mac para usar **Domino Tournament Manager Pro** gratis en tus propios torneos con los vecinos, o para entregar claves de por vida a tus compradores (\$10 lanzamiento).

---

## 1. Dónde está tu clave privada (¡MUY IMPORTANTE!)

- Tu clave privada vive únicamente en tu Mac en:
  ```text
  .keys/ed25519-private.pem
  ```
- La carpeta `.keys/` está agregada a `.gitignore` para que **nunca** se suba a GitHub.
- La app web publicada solo contiene la **clave pública** (`src/infrastructure/license-public-key.ts`), por lo que nadie puede fabricar claves válidas sin tu archivo `.pem`.
- **Respaldo:** guarda una copia segura de `.keys/ed25519-private.pem` (por ejemplo en iCloud Drive privado, 1Password o un pendrive), porque si formateas la Mac sin respaldo perderás la capacidad de emitir nuevas claves compatibles con esa clave pública.

---

## 2. Cómo generar una licencia Pro (para ti o para la PC de un vecino)

Abre una terminal dentro de la carpeta del proyecto (`domino-tournament-manager`) y ejecuta:

```bash
npm run license:issue -- --name "Enrique Villasana"
```

O si quieres dedicársela a un vecino o club:

```bash
npm run license:issue -- --name "Torneo Vecinos La Urbina" --note "Vecino amigo"
```

En 1 segundo la terminal imprimirá algo como:

```text
=== Domino Tournament Manager — Pro License ===
Holder:    Torneo Vecinos La Urbina
ID:        DTM-20261127-A1B2C3
Issued at: 2026-11-27

DTM-PRO-1.eyJ2IjoxLCJwbGFuIjoicHJvIiwiaG9sZGVyIjoi...<firma>
```

---

## 3. Cómo instalar esa licencia en tu PC/teléfono o en la PC del vecino

1. Abre la app web (`https://villasana26enrique.github.io/domino-tournament-manager/`) en el navegador del equipo donde van a jugar (incluso sin internet si ya está instalada como PWA).
2. Haz clic en el botón **`Hazte Pro ($10)`** / **`Get Pro ($10)`** arriba a la derecha (o en la tarjeta Pro de la pantalla inicial).
3. Pega la línea completa `DTM-PRO-1....` en el campo de activación y presiona **`Activar Pro`**.
4. ¡Listo! Quedará guardada localmente en ese navegador/equipo para siempre (**\$0**, 100% offline). Ahí mismo podrás configurar el **Nombre del Club / Partida** y subir un **Logo** para la TV y los PDFs.

> **Nota práctica:** si quieres revocar Pro en una PC prestada al terminar un torneo, abre el botón **`Pro`** arriba a la derecha y presiona **`Quitar licencia`**.

---

## 4. Cómo actualizar tus datos de contacto o pago (WhatsApp / USDC)

Cuando quieras activar cobros semi-manuales por WhatsApp, USDC, Zelle, PayPal o Pago Móvil, edita un solo archivo:

- [`src/infrastructure/commercial-config.ts`](src/infrastructure/commercial-config.ts)
  - `contactEmail`: tu correo de contacto.
  - `whatsappUrl`: por ejemplo `'https://wa.me/58412XXXXXXX?text=Hola%20quiero%20la%20licencia%20Pro'`.
  - `usdcWalletNote`: tu dirección USDC (Base / Polygon / Solana / Stellar) si decides mostrarla en el modal.
