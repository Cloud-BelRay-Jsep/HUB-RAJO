/* ==========================================================================
   HUB MINA · CONFIGURACIÓN
   --------------------------------------------------------------------------
   Este es el ÚNICO archivo que necesitas editar en el día a día:
     1. Pegar las URLs de los tableros                       → modules[].views[].url
     2. Cambiar la cobertura de un módulo por subflota       → modules[].coverage
     3. Cambiar flotas, subflotas, logos o textos            → groups / plants / brand

   Misma base que el HUB Plantas: la interfaz se arma sola a partir de este
   archivo. No hace falta compilar nada: guarda, sube y recarga (Ctrl+F5).
   Al publicar cambios, sube el número ?v= en index.html.
   ========================================================================== */

window.HUB_CONFIG = {

  /* ------------------------------------------------------------------------
     MARCA
     ------------------------------------------------------------------------ */
  brand: {
    title: 'HUB Mina',
    subtitle: 'Soluciones de lubricación en Mina Rajo, Los Bronces',
    client:  { name: 'Anglo American', logo: 'assets/img/logo-anglo-american.png', logoDark: 'assets/img/logo-anglo-american-dark.png' },
    partner: { name: 'Bel-Ray Chile',  logo: 'assets/img/logo-belray.png',         logoDark: '' },
    statusText: 'Sistema operativo',
    siteText: 'Los Bronces, Mina Rajo',
    timeZone: 'America/Santiago'
  },

  /* ------------------------------------------------------------------------
     PALABRAS DE LA INTERFAZ
     unit    → primer nivel del selector ("Todas las flotas", #flota=…)
     subunit → segundo nivel ("Elige una subflota…", "3 de 16 subflotas")
     ------------------------------------------------------------------------ */
  unit:    { singular: 'flota', plural: 'flotas', param: 'flota', storageKey: 'hub-mina-flota' },
  subunit: { singular: 'subflota', plural: 'subflotas' },

  /* ------------------------------------------------------------------------
     FLOTAS (primer nivel del selector y fila superior de la matriz)
     El orden de esta lista es el orden en el selector y en la matriz.
     Una flota con una sola subflota del mismo nombre (AMDA) se muestra como
     una sola columna.
     ------------------------------------------------------------------------ */
  groups: [
    { id: 'carguio',     name: 'Carguío' },
    { id: 'perforacion', name: 'Perforación' },
    { id: 'transporte',  name: 'Transporte' },
    { id: 'servicio',    name: 'Servicio' },
    { id: 'amda',        name: 'AMDA' }
  ],

  /* ------------------------------------------------------------------------
     SUBFLOTAS (el campo se llama "plants" por compatibilidad con el código)
     id     → identificador interno (sin espacios ni tildes). No lo cambies
              una vez publicado: se usa en los enlaces directos y en coverage.
     name   → nombre visible.   short → abreviatura para la matriz.
     group  → id de la flota a la que pertenece.
     ------------------------------------------------------------------------ */
  plants: [
    // Carguío
    { id: 'palas-electricas',      group: 'carguio',     name: 'Palas Eléctricas',          short: 'Palas eléctricas' },
    { id: 'palas-hidraulicas',     group: 'carguio',     name: 'Palas Hidráulicas',         short: 'Palas hidráulicas' },
    { id: 'cargadores-letourneau', group: 'carguio',     name: 'Cargadores LeTourneau',     short: 'Carg. LeTourneau' },
    // Perforación
    { id: 'smartroc',              group: 'perforacion', name: 'SmartROC',                  short: 'SmartROC' },
    { id: 'pit-viper',             group: 'perforacion', name: 'Pit Viper',                 short: 'Pit Viper' },
    // Transporte
    { id: 'caex-930e',             group: 'transporte',  name: 'CAEX 930E',                 short: 'CAEX 930E' },
    // Servicio
    { id: 'bulldozer',             group: 'servicio',    name: 'Bulldozer',                 short: 'Bulldozer' },
    { id: 'canon-niebla',          group: 'servicio',    name: 'Cañón de niebla',           short: 'Cañón de niebla' },
    { id: 'cargador-frontal',      group: 'servicio',    name: 'Cargador Frontal',          short: 'Cargador frontal' },
    { id: 'excavadoras',           group: 'servicio',    name: 'Excavadoras',               short: 'Excavadoras' },
    { id: 'manipulador-cables',    group: 'servicio',    name: 'Manipulador de cables',     short: 'Manip. de cables' },
    { id: 'manipulador-neumaticos',group: 'servicio',    name: 'Manipulador de neumáticos', short: 'Manip. de neumáticos' },
    { id: 'motoniveladoras',       group: 'servicio',    name: 'Motoniveladoras',           short: 'Motoniveladoras' },
    { id: 'rodillo-compactador',   group: 'servicio',    name: 'Rodillo Compactador',       short: 'Rodillo compactador' },
    { id: 'wheeldozer',            group: 'servicio',    name: 'Wheeldozer',                short: 'Wheeldozer' },
    // AMDA
    { id: 'amda',                  group: 'amda',        name: 'AMDA',                      short: 'AMDA' }
  ],

  /* ------------------------------------------------------------------------
     LÍNEAS DE NEGOCIO (pilares)
     El orden define el orden en la portada, la matriz y el menú del visor.
     ------------------------------------------------------------------------ */
  categories: [
    { id: 'lubricantes',    name: 'Lubricantes' },
    { id: 'automatizacion', name: 'Automatización' },
    { id: 'servicio',       name: 'Servicio' }
  ],

  /* ------------------------------------------------------------------------
     MÓDULOS
     views[].url acepta:
        ▸ Página propia del HUB (carpeta modulos/): 'modulos/archivo.html'
        ▸ Looker Studio: el enlace tal como aparece en el navegador, la URL
          /embed/ o el código <iframe> completo (el HUB lo normaliza).
          Recuerda: Archivo › Insertar informe › Habilitar inserción, y
          compartir con "Cualquier persona con el vínculo" o con los usuarios.
        ▸ Carpeta de Google Drive (…/drive/folders/…).
     views[].urlPorPlanta → (opcional) una URL distinta por subflota.
     coverage → por subflota: 'activo' · 'parcial' · 'proximamente' · 'noAplica'.
                '*' aplica el mismo estado a todas las subflotas no listadas.
                Subflota no listada (y sin '*') = Próximamente.
     ------------------------------------------------------------------------ */
  modules: [

    /* ===== LUBRICANTES ===== */
    {
      id: 'optimizacion',
      category: 'lubricantes',
      name: 'Optimización Volumétrica',
      description: 'Simuladores de dosificación por equipo: LubeCalc Pro para las palas eléctricas y la ingeniería SL-V de la Plataforma SCL para los CAEX 930E.',
      views: [
        // ▼▼▼ Páginas propias del HUB, una por subflota (sin vista general)
        { id: 'general', name: 'Optimización Volumétrica',
          url: '',
          urlPorPlanta: {
            'palas-electricas': 'modulos/lubecalc-pro.html',           // LubeCalc Pro · Shovel Edition (PAB12)
            'caex-930e':        'modulos/plataforma-scl-930e.html'     // la reescribe la tarea diaria (6:48)
          } }
      ],
      coverage: {
        'palas-electricas': 'activo',
        'caex-930e':        'activo'
      }
    },
    {
      id: 'consumos',
      category: 'lubricantes',
      name: 'Registro de Consumos',
      description: 'Consumo de lubricantes de todas las flotas, con un tablero diario y uno semanal para controlar el gasto y detectar desviaciones.',
      views: [
        // ▼▼▼ URL — Looker Studio · Registro de Consumos diario
        { id: 'diario',  name: 'Diario',
          url: 'https://datastudio.google.com/embed/reporting/636130df-eda6-4033-8c6d-303b6490dddd/page/p_ey3w20urnd' },
        // ▼▼▼ URL — Looker Studio · Registro de Consumos semanal
        { id: 'semanal', name: 'Semanal',
          url: 'https://datastudio.google.com/embed/reporting/d0f99b92-d9c6-4dbc-9328-bba7f7e989fd/page/jcDtD' }
      ],
      coverage: { '*': 'activo' }     // todas las flotas
    },

    /* ===== AUTOMATIZACIÓN ===== */
    {
      id: 'inspeccion-scl',
      category: 'automatizacion',
      name: 'Inspección de SCL',
      description: 'Resultados de la inspección de los sistemas centralizados de lubricación: condición por punto, estación de bombeo y desviaciones por equipo.',
      views: [
        // ▼▼▼ URL — Looker Studio · Inspección de SCL (solo CAEX)
        { id: 'general', name: 'Inspección de SCL',
          url: 'https://datastudio.google.com/embed/reporting/fe321c26-3d50-4114-a08b-2c9bf1c9eaa7/page/p_azqji7752d' }
      ],
      coverage: {
        'caex-930e': 'activo'
      }
    },

    /* ===== SERVICIO ===== */
    {
      id: 'observaciones',
      category: 'servicio',
      name: 'Observaciones Técnicas',
      description: 'Hallazgos y observaciones técnicas levantadas por el servicio en terreno, con su seguimiento por equipo.',
      views: [
        // ▼▼▼ URL — Looker Studio · Observaciones técnicas
        { id: 'general', name: 'Observaciones Técnicas',
          url: 'https://datastudio.google.com/embed/reporting/88fda0ba-f51b-4f5c-97cd-f06f2be7d3f2/page/p_v49kkolt3d' }
      ],
      coverage: { '*': 'activo' }     // por confirmar: hoy se muestra en todas las flotas
    },
    {
      id: 'entrega-turno',
      category: 'servicio',
      name: 'Entrega de Turno',
      description: 'Registro de la entrega de turno del servicio de lubricación: actividades realizadas, pendientes y novedades para el turno siguiente.',
      views: [
        // ▼▼▼ URL — Looker Studio · Entrega de turno
        { id: 'general', name: 'Entrega de Turno',
          url: 'https://datastudio.google.com/embed/reporting/42918f27-78aa-4cc0-b258-d12274b54c43/page/p_iurftzivud' }
      ],
      coverage: { '*': 'activo' }     // por confirmar: hoy se muestra en todas las flotas
    }
  ]
};
