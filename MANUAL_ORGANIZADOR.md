# Guía Rápida del Organizador — Domino Tournament Manager

**App web / PWA instalable (100% offline):** https://villasana26enrique.github.io/domino-tournament-manager/

---

## 1. Instalación en cualquier dispositivo (sin internet durante el torneo)

- **iPhone / iPad (Safari):** abre el enlace → botón **Compartir** → **Agregar a pantalla de inicio**.
- **Android / Chrome / Edge (Windows o Mac):** abre el enlace → botón **Instalar app** arriba a la derecha (o menú del navegador → *Instalar*).
- **Escritorio Windows (`.exe` opcional):** ejecuta el instalador `NSIS` generado desde Releases/Actions (`Tauri v2 + SQLite`).

---

## 2. Antes de iniciar (5 minutos)

1. Escribe el nombre del evento y pulsa **Crear torneo**.
2. Agrega jugadores uno por uno o pega la lista completa (**1 nombre por línea**); la numeración es automática (`#1`, `#2`...).
3. Pulsa **Generar torneo** para abrir la **Previsualización**:
   - **Por rondas (todos juegan igual):** disponible cuando el total de jugadores es **múltiplo de 4** (8, 12, 16, 20, 24…). **0 descansos**, todos juegan las mismas rondas rotando de compañero.
   - **Clasificatoria + Eliminaciones:** disponible para **cualquier cantidad ($\ge 4$)**. Juega 2 rondas clasificatorias (si hay descansos en R1, pasan libre a R2; los descansos de R2 priorizan ganadores de R1), recorta a múltiplo exacto de 4 (`16 → 8 → 4`) sin descansos y define campeón en una **Gran Final de 1 partida**.
4. *(Opcional)* Descarga el **Reglamento PDF** o revisa las mesas iniciales con **Regenerar sorteo** antes de pulsar **Confirmar e iniciar torneo**. Una vez iniciado, las reglas quedan congeladas.

---

## 3. Reglas oficiales y operación en vivo

- **Meta de puntos (100 pts sin recorte):** si una pareja llega a `124` contra `78`, se registra exactamente `124 - 78` para el diferencial individual.
- **Reloj de ronda (`25 min` con alarma a los `2 min`):**
  - El **Modo Proyección** pone el reloj gigante, las mesas activas (y la **Llave en vivo** en eliminatorias) listo para TV o proyector, manteniendo la pantalla despierta.
  - **Regla al agotarse el tiempo:** se culmina **únicamente la mano en curso** y se registran los puntos reales. Si hay igualdad, queda registrado como **empate** (`0.5` pts de partida, **sin muerte súbita**).
- **Contingencias a mitad del torneo (pestaña *Participantes*):**
  - **Sustituto:** reemplaza a quien se retira heredando su puesto y manteniendo mesas exactas con **0 descansos**.
  - **Retiro administrativo:** deja la puntuación acumulada intacta y recalcula únicamente las rondas futuras.
- **PIN de organizador (opcional):** en la barra superior (`Proteger con PIN`), oculta el botón de prueba `Simular resultados` y exige un PIN de 4–6 dígitos antes de corregir marcadores, retirar jugadores o eliminar torneos.

---

## 4. Al finalizar y respaldo

- **Cierre:** descarga el **Reporte PDF oficial** (tabla definitiva, estadísticas, historial mesa por mesa y correcciones auditadas), imprime o comparte la **Tarjeta WhatsApp (PNG)**.
- **Portabilidad entre equipos:** en la pantalla inicial, **Respaldo local** exporta e importa todo en un archivo `.json`.

---

### Quick English Reference

1. Open/install PWA offline → **Create tournament** → paste 1 player per line → **Generate tournament**.
2. Choose **Fixed Rounds** (multiples of 4, 0 byes) or **Qualifying + Knockouts** (any $N \ge 4$, single-match Grand Final).
3. **25 min timer + uncapped scores:** when time expires, finish only the hand in progress; ties count as `0.5` match pts (no sudden death).
4. Use **Projection mode** for TV/screen casting, **Organizer PIN** to guard edits, and export **Rules/Report PDF**, **Share WhatsApp Card (PNG)**, or **JSON backup** on completion.
