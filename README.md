# centusdev.com

Web personal de **Centus Dev**: HTML, CSS y JavaScript sin dependencias, publicada con GitHub Pages.

| Archivo | Qué es |
| --- | --- |
| `index.html` | Todo el contenido de la web |
| `personal-site.css` | Estilos (paleta: blanco, `#ffec90`, `#623722`) |
| `personal-site.js` | Interacción: lente de rayos X, vídeos, línea temporal, modo debug |
| `centus-game.js` | Minijuego secreto (se carga solo al pulsar el coche del pie de página) |
| `data/videos.json` | Últimos Shorts y récords de YouTube (se genera solo) |
| `scripts/update-videos.mjs` | Script que descarga los datos de YouTube |
| `images/projects/` | Capturas de los juegos de itch.io |
| `images/brands/` | Logos de marcas y de Virtual Soul |

## Vídeos que se actualizan solos

1. `.github/workflows/update-videos.yml` se ejecuta cada 6 horas en GitHub Actions.
2. Lee el feed RSS público de los Shorts de `youtube.com/@CentusDev` (sin API key), la página del canal y los perfiles públicos de TikTok e Instagram (seguidores). Si alguna red bloquea la petición, se mantiene el último dato bueno.
3. Si hay cambios, guarda `data/videos.json` y pide a GitHub Pages que vuelva a publicar.
4. La web lee ese JSON al cargar: muestra los 5 últimos Shorts, la tabla de récords, los seguidores y las cifras del hero.

Los datos del bloque «Media kit» (engagement, edad, países) son fijos y salen de Beacons: actualízalos a mano en `index.html` cuando cambien.

Para forzar una actualización: pestaña **Actions** → **Actualizar vídeos** → **Run workflow**.
Para probarlo en local: `node scripts/update-videos.mjs`.

TikTok e Instagram no ofrecen una forma pública y estable de leer los últimos vídeos sin una app aprobada y tokens, así que la sección usa YouTube Shorts (los mismos vídeos) y enlaza a los tres perfiles.

## Probar en local

```bash
python -m http.server 8765
```

Y abrir `http://localhost:8765`.

## Easter egg

El coche del pie de página abre «Los coches son esferas»: recoge 5 banderines en 25 s. Al ganar se desbloquea el **modo debug** (botón en la cabecera o tecla `D`), que muestra las hitboxes de toda la web.
