# HUB Mina — Guía de despliegue y mantención

Portal de acceso a las soluciones del servicio de lubricación Bel-Ray Chile en las flotas de Mina Rajo, Anglo American Los Bronces. Usa la misma base que el HUB Plantas: sitio **100 % estático**, sin servidor, base de datos ni CDNs externos.

## Contenido

```
HUB-Mina/                      ← raíz del repositorio
├── index.html                 ← redirige a hub-flotas/
└── hub-flotas/
    ├── index.html             ← la página
    ├── config.js              ← ★ ÚNICO archivo que se edita: flotas, pilares, módulos, cobertura
    ├── LEEME-DESPLIEGUE.md    ← esta guía
    ├── modulos/               ← páginas propias del HUB
    │   ├── lubecalc-pro.html            (LubeCalc Pro · Palas Eléctricas)
    │   └── plataforma-scl-930e.html     (Plataforma SCL · CAEX 930E, se reescribe cada mañana)
    └── assets/                ← css, js, fuente Archivo y logos (mismos del HUB Plantas)
```

## Usarlo sin publicar (en tu computador)

Doble clic en `HUB-Mina/index.html` (o en `hub-flotas/index.html`). Se abre en Chrome o Edge y funciona completo: selector de flotas, matriz, visor, pantalla completa y modo claro/oscuro. La fuente va incrustada, así que se ve igual que publicado.

- Las fotos de la Plataforma SCL necesitan internet y tu sesión de Google, igual que en la web.
- Los tableros de Looker Studio que agregues más adelante también necesitan internet.
- Para compartirlo sin publicar, comprime la carpeta `HUB-Mina` completa y envíala: quien la reciba la descomprime y abre `index.html`. Si se envía solo un archivo suelto, no funciona.

## Publicar en GitHub Pages

1. Crea el repositorio `HUB-Mina` en `cloud-belray-jsep` (público).
2. En la **página principal del repositorio**: *Add file › Upload files* → arrastra **`index.html` y la carpeta `hub-flotas` completa** → *Commit changes*.
   - ⚠️ No entres a `hub-flotas/` antes de arrastrar: la carpeta quedaría anidada (`hub-flotas/hub-flotas/`) y no se publica.
3. *Settings › Pages › Branch: main / root* › Save.
4. Quedará en `https://cloud-belray-jsep.github.io/HUB-Mina/`. Recarga con **Ctrl + Shift + R**.

## Mantención (todo en `config.js`)

| Quiero… | Qué edito |
|---|---|
| Agregar un tablero de Looker | Un módulo nuevo en `modules` con su `url` y `coverage` |
| Agregar una página HTML propia | Copiarla a `modulos/` y usar `url: 'modulos/archivo.html'` |
| Activar un módulo en otra flota | En `coverage`, agregar `'id-flota': 'activo'` |
| Agregar una flota | Un objeto `{ id, name }` en `groups` |
| Agregar una subflota | Un objeto `{ id, group, name, short }` en `plants` (`group` = id de su flota) |
| Activar un módulo en todas las subflotas | `coverage: { '*': 'activo' }` |
| Cambiar las palabras "flota" / "subflota" | `unit` y `subunit` |

Al cambiar `config.js`, `hub.js` o `hub.css`, sube el número `?v=` en `hub-flotas/index.html`.

## Enlaces directos

- Flota filtrada: `…/hub-flotas/#flota=caex-930e`
- Flota completa: `…/hub-flotas/#flota=carguio`
- Módulo abierto: `…/hub-flotas/#flota=caex-930e&modulo=inspeccion-scl`
- Tablero específico: `…/hub-flotas/#modulo=consumos&vista=semanal`

## Actualización diaria de la Plataforma SCL

La tarea programada "Actualizar Hub Rajo Mina · CAEX 930E" (6:48) lee la planilla de AppSheet y reescribe `hub-flotas/modulos/plataforma-scl-930e.html` en la carpeta local `Descargas/Hub_RajoMina/HUB-Mina/`. Mientras GitHub no esté conectado a Claude, ese archivo se sube a mano al repositorio (*Add file › Upload files* dentro de `hub-flotas/modulos/`).

## Seguridad

GitHub Pages es público para quien tenga el enlace. Las fotos de inspección siguen privadas en Google Drive (solo las ven cuentas con acceso). Para restringir el sitio: Cloudflare Pages + Cloudflare Access (gratis hasta 50 usuarios), sin cambios en el HUB.
