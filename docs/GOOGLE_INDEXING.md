# Cómo indexar la app en Google Search Console (5 minutos)

La aplicación web ya cuenta con SEO técnico configurado ([index.html](../index.html), [robots.txt](../public/robots.txt), [sitemap.xml](../public/sitemap.xml) y datos estructurados JSON-LD `SoftwareApplication`). Solo falta dar de alta la URL una sola vez en Google para acelerar su aparición en resultados de búsqueda.

---

## Pasos en Google Search Console

1. Entra a **https://search.google.com/search-console** con tu cuenta de Google.
2. Haz clic en **Agregar propiedad** y elige la opción derecha: **Prefijo de la URL** (*URL prefix*).
3. Pega exactamente la URL publicada:
   ```text
   https://villasana26enrique.github.io/domino-tournament-manager/
   ```
4. **Verificación de propiedad:** elige el método **Etiqueta HTML** (`<meta name="google-site-verification" content="..." />`):
   - Copia esa etiqueta meta que te da Google, pégala dentro del `<head>` de [`index.html`](../index.html) y haz commit + merge a `main`.
   - Espera ~1 minuto a que termine el workflow `Deploy Web Preview to GitHub Pages` y pulsa **Verificar** en Search Console.
5. **Enviar el Sitemap:**
   - En el menú izquierdo entra a **Sitemaps**.
   - Escribe `sitemap.xml` en el campo de nueva URL y presiona **Enviar** (quedará `https://villasana26enrique.github.io/domino-tournament-manager/sitemap.xml`).
6. **Solicitar indexación inmediata:**
   - Arriba en la barra **Inspeccionar cualquier URL**, pega `https://villasana26enrique.github.io/domino-tournament-manager/`.
   - Haz clic en **Solicitar indexación** (*Request indexing*).

Con eso Google suele rastrear e indexar la página entre **24 horas y unos pocos días**, sin costos mensuales ni mantenimiento adicional.
