<div align="center">

![Hero Banner](public/imgs/home.png)

# 📈 CamelClone PC — Rastreador de Precios de PCComponentes

Un sistema completo de monitorización de precios para **PCComponentes.com**. Añade productos pegando su URL, y el sistema se encarga de hacer scraping automático, registrar el historial de precios, detectar ofertas y lanzar alertas cuando los precios cambian.

![Tech Stack](public/imgs/producto.png)

</div>

---

## Índice

1. [Características principales](#características-principales)
2. [Arquitectura del sistema](#arquitectura-del-sistema)
3. [Estructura de archivos](#estructura-de-archivos)
4. [Requisitos previos](#requisitos-previos)
5. [Instalación paso a paso](#instalación-paso-a-paso)
6. [Configuración del entorno](#configuración-del-entorno)
7. [Base de datos](#base-de-datos)
8. [Comandos disponibles](#comandos-disponibles)
9. [Cómo usar la aplicación](#cómo-usar-la-aplicación)
10. [API — Endpoints](#api--endpoints)
11. [Flujo del scraping](#flujo-del-scraping)
12. [Sistema de alertas](#sistema-de-alertas)
13. [Tareas automáticas (Cron)](#tareas-automáticas-cron)
14. [Variables de entorno](#variables-de-entorno)
15. [Errores comunes y soluciones](#errores-comunes-y-soluciones)

---

## Características principales

- **Scraping automático** de precios desde PCComponentes usando Puppeteer con evasión de bots.
- **Historial completo de precios** con filtros por periodo (3 meses, 6 meses, 1 año, todo).
- **Detección de ofertas automática**: los productos con ≥ 30% de descuento se muestran en la sección de "Chollos".
- **Sistema de alertas configurable** con 5 tipos de alerta (precio bajo, precio alto, variación porcentual, disponibilidad, agotado).
- **Actualización automática** cada 6 horas de todos los productos rastreados.
- **Verificación de alertas** cada 30 minutos.
- **API REST completa** con endpoints para productos, analytics y alertas.
- **Frontend responsive** con 4 páginas, paginación, búsqueda y notificaciones toast.
- **Base de datos en la nube** con Supabase (PostgreSQL).

---

## Arquitectura del sistema

```bash
.
├── database/                # Scripts de definición de la base de datos (SQL)
│   └── schema.sql
│
├── public/                  # Archivos estáticos del Frontend (Cliente)
│   ├── imgs/                # Directorio de imágenes
│   ├── css/                 # Hojas de estilo (style.css, productoDetalle.css)
│   ├── js/                  # Lógica del cliente (app.js, productoDetalle.js)
│   └── *.html               # Páginas HTML (index, chollos, producto...)
│
├── src/                     # Código fuente del Backend (Servidor)
│   ├── config/              # Configuración de la aplicación (ej. conexión BD)
│   ├── models/              # Modelos de datos (Alertas, Productos, Historial)
│   ├── routes/              # Definición de rutas API (endpoints)
│   ├── scrapers/            # Lógica específica de web scraping (Puppeteer)
│   ├── scripts/             # Scripts de utilidad (ej. inicialización de BD)
│   └── services/            # Lógica de negocio (capa intermedia entre rutas y modelos)
│
├── .env                     # (NO INCLUIDO EN GIT) Variables de entorno y credenciales
├── .env.example             # Plantilla de ejemplo para las variables de entorno
├── .gitignore               # Archivos ignorados por Git (ej. node_modules, .env)
├── package.json             # Metadatos del proyecto y lista de dependencias
└── server.js                # PUNTO DE ENTRADA PRINCIPAL del servidor Node.js

```

El sistema sigue una estructura capas clásica:

**Frontend (public/)** — Cuatro páginas HTML conectadas al backend mediante llamadas `fetch()` a la API REST. El JavaScript (`app.js` y `productoDetalle.js`) gestiona la lógica del interfaz, la paginación y las notificaciones toast.

**Backend (src/)** — Express recibe las peticiones, las enruta a los routers correspondientes (`productos`, `analytics`, `alertas`), que delegan la lógica de negocio a los servicios (`ScraperService`, `AlertasService`), y estos usan los modelos para interactuar con la base de datos.

**Datos** — La conexión a PostgreSQL se gestiona con el paquete `pg` mediante un Pool de conexiones. La base de datos vive en Supabase (hosting en la nube). El scraping se realiza con Puppeteer, que visita PCComponentes.com en un Chrome headless.

---

## Estructura de archivos

| Carpeta | Contenido |
|---|---|
| `public/` | Todo el frontend: HTML, CSS y JS del interfaz |
| `src/config/` | Configuración de la conexión a la base de datos |
| `src/models/` | Modelos que contienen las consultas SQL (producto, historial, alertas) |
| `src/routes/` | Routers de Express que definan los endpoints de la API |
| `src/services/` | Lógica de negocio: scraping y verificación de alertas |
| `src/scrapers/` | La clase `PuppeteerScraper` que hace el scraping real |
| `src/scripts/` | Scripts auxiliares como la inicialización de la BD |
| `database/` | El archivo `schema.sql` con la estructura de las tablas |

---

## Requisitos previos

Antes de empezar, asegúrate de tener instalado lo siguiente:

| Herramienta | Versión mínima | Para qué |
|---|---|---|
| **Node.js** | v20.x o superior | Runtime del servidor |
| **npm** | v10.x o superior | Gestor de paquetes |
| **Git** | cualquiera | Clonar el repositorio |
| **Cuenta de Supabase** | gratuita | Base de datos PostgreSQL en la nube |

> ⚠️ **Importante:** No necesitas instalar PostgreSQL en tu máquina. El proyecto usa Supabase como hosting de la base de datos, así que solo falta una cuenta gratuita en [supabase.com](https://supabase.com).

---

## Instalación paso a paso

### Paso 1 — Clonar el repositorio

```bash
git clone <URL_del_repositorio>
cd rastreador-de-precios-pccomponentes
```

### Paso 2 — Instalar dependencias

```bash
npm install
```

Esto descargará los paquetes que define el `package.json`:

| Paquete | Versión | Función |
|---|---|---|
| `express` | ^4.18.2 | Servidor HTTP y framework web |
| `cors` | ^2.8.5 | Permitir peticiones cross-origin |
| `pg` | ^8.11.3 | Cliente de PostgreSQL para Node.js |
| `puppeteer` | ^21.6.1 | Automatización de Chrome para scraping |
| `node-cron` | ^3.0.3 | Programación de tareas automáticas |

### Paso 3 — Crear la cuenta de Supabase y obtener el connection string

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto (da un nombre y elige la región más cercana, por ejemplo `eu-west-1`).
3. Espera a que el proyecto se inicialice (puede tardar un par de minutos).
4. Ve a **Project Settings → Database → Connect**.
5. Elige **Node.js** como framework.
6. Copia el **connection string** que tiene un aspecto similar a este:

```
postgresql://postgres.XXXXXXXX:CONTRASEÑA@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
```

Este connection string lo necesitarás en el paso siguiente.

### Paso 4 — Configurar el archivo `.env`

```bash
cp .env.example .env
```

Abre `.env` con tu editor y rellena los valores:

```env
PORT=3000
NODE_ENV=development

# Connection string de Supabase (cópialo del paso anterior)
DB_URL=postgresql://postgres.XXXXXXXX:CONTRASEÑA@aws-1-eu-west-1.pooler.supabase.com:6543/postgres

# Configuración del scraping
SCRAPE_INTERVAL_MINUTES=60
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36
```

> **Nunca subas el archivo `.env` al repositorio.** Ya está en el `.gitignore`, pero es buena práctica comprobarlo.

### Paso 5 — Inicializar la base de datos

```bash
npm run init-db
```

Este comando ejecuta el script `initDB.js` que lee el archivo `database/schema.sql` y crea las tres tablas en Supabase:

- `productos`
- `historial_precios`
- `alertas`

Si todo sale bien, verás un mensaje confirmando que las tablas se han creado correctamente. Si alguna ya existe, no se sobreescribe (usa `CREATE TABLE IF NOT EXISTS`).

### Paso 6 — Iniciar el servidor

```bash
npm run dev
```

Si todo está configurado correctamente, verás este mensaje en la consola:

```
======================================================================
🚀 SERVIDOR INICIADO CORRECTAMENTE
======================================================================
🖥️  Servidor:     http://localhost:3000
📱 API:          http://localhost:3000/api
🌐 Frontend:     http://localhost:3000
💚 Health Check: http://localhost:3000/api/salud
======================================================================
```

Abre el navegador y ve a **http://localhost:3000** — la aplicación debería estar funcionando.

---

## Configuración del entorno

![Alertas tipos](public/imgs/env.example.png)

El archivo `.env.example` contiene todas las variables que el proyecto puede usar:

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto en el que escucha el servidor Express |
| `NODE_ENV` | `development` | Entorno de ejecución |
| `DB_URL` | — | Connection string de Supabase (obligatorio) |
| `SCRAPE_INTERVAL_MINUTES` | `60` | Intervalo de referencia para el scraping |
| `USER_AGENT` | Chrome/Edge 131 | User-Agent que simula Puppeteer para evitar bloqueos |
| `CRON_SCHEDULE` | `0 */6 * * *` | Expresión cron de la actualización automática (cada 6 horas) |

---

## Base de datos

![Esquema BD](public/imgs/db.png)

### Tablas

**`productos`** — Almacena los productos que el usuario decide rastrear. Cada producto tiene una URL única (constraint `UNIQUE`), que evita que se añada duplicado.

**`historial_precios`** — Registra cada cambio de precio, disponibilidad o descuento. Cada fila es un "snapshot" en un momento concreto. Se crea un nuevo registro solo cuando algo cambia (precio, disponibilidad o descuento), lo que mantiene el historial limpio y sin duplicados.

**`alertas`** — Define las condiciones que el usuario quiere monitorear. Cada alerta tiene un tipo, un umbral (si aplica), y se puede activar/desactivar libremente.

### Relaciones

Ambas tablas secundarias (`historial_precios` y `alertas`) tienen una clave foránea `producto_id` que referencia a `productos(id)` con **ON DELETE CASCADE**. Esto significa que si eliminas un producto, su historial de precios y sus alertas se eliminan automáticamente.

### Migración: porcentaje_descuento

El proyecto incluye un script de migración (`migracionDescuento.js`) que añade la columna `porcentaje_descuento` a la tabla `historial_precios`. Si la columna ya existe (por ejemplo, si usaste `init-db` con el schema actualizado), no hace nada. Para ejecutarlo manualmente:

```bash
node --env-file=.env src/scripts/migracionDescuento.js
```

---

## Comandos disponibles

Estos son los scripts que define el `package.json`:

| Comando | Equivale a | Qué hace |
|---|---|---|
| `npm run dev` | `node --env-file=.env --watch server.js` | Inicia el servidor en modo desarrollo con **auto-recarga** al guardar archivos |
| `npm start` | `node --env-file=.env server.js` | Inicia el servidor en modo producción (sin auto-recarga) |
| `npm run init-db` | `node --env-file=.env src/scripts/initDB.js` | Crea las tablas en Supabase si no existen |

---

## Cómo usar la aplicación

### Añadir un producto

1. Copia la URL de cualquier producto en PCComponentes.com (por ejemplo: `https://www.pccomponentes.com/...`).
2. En la barra superior de la aplicación, pégala en el campo de búsqueda.
3. Haz clic en el botón **+ Rastrear**.
4. El sistema hace scraping automático, obtiene el nombre, precio, imagen y descuento, lo guarda en la base de datos, y te redirige a la página de detalle del producto.

### Páginas de la aplicación

| Página | URL | Contenido |
|---|---|---|
| **Inicio** | `/` | Los 4 mejores chollos + los 4 últimos productos añadidos |
| **Chollos** | `/chollos.html` | Todos los productos con ≥ 30% de descuento, paginados (8 por página) |
| **Productos** | `/productos.html` | Listado completo de todos los productos rastreados, paginados (12 por página) |
| **Producto** | `/producto.html?id=X` | Detalle de un producto: precio actual, estadísticas, historial y botón de actualización manual |

### Actualizar el precio manualmente

En la página de detalle de cualquier producto hay un botón ** Actualizar Precio**. Al pulsarlo, el sistema hace un scraping en ese momento y, si el precio ha cambiado, lo registra inmediatamente sin esperar a la tarea automática.

---

## API — Endpoints

![Endpoints](public/imgs/api.png)

### /api/productos

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/productos` | Lista paginada de todos los productos. Parámetros: `limite`, `offset`, `activo`, `tienda` |
| GET | `/api/productos/destacados` | Productos destacados (los que están en oferta importante) |
| GET | `/api/productos/buscar?q=texto` | Buscar productos por nombre |
| GET | `/api/productos/:id` | Obtener un producto concreto por su ID |
| POST | `/api/productos` | Añadir un producto nuevo. Body: `{ "url": "https://..." , "categoria": "..." }` |
| PUT | `/api/productos/:id` | Actualizar datos de un producto |
| DELETE | `/api/productos/:id` | Eliminar un producto (CASCADE: borra historial y alertas) |
| GET | `/api/productos/:id/historial` | Historial de precios. Parámetro opcional: `periodo` (3months, 6months, 1year, all) |
| GET | `/api/productos/:id/historial-grafica` | Historial agrupado para gráficas |
| GET | `/api/productos/:id/estadisticas` | Precio mínimo, máximo, promedio y actual |
| POST | `/api/productos/:id/actualizar-precio` | Forzar una actualización de precio inmediata |
| GET | `/api/productos/:id/cambios-precio` | Detectar cambios de precio significativos |

### /api/analytics

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/analytics/mejores-ofertas` | Productos con el mayor descuento. Parámetro: `min_descuento` (default 30) |
| GET | `/api/analytics/alertas-precio` | Productos con cambios de precio significativos. Parámetro: `umbral` (%) |
| GET | `/api/analytics/tendencias` | Productos con más actividad de precio. Parámetro: `dias` |
| POST | `/api/analytics/comparar` | Comparar varios productos. Body: `{ "producto_ids": [1, 2, 3] }` |
| GET | `/api/analytics/estadisticas-tienda` | Estadísticas agrupadas por tienda |
| GET | `/api/analytics/resumen-general` | Resumen global: total productos, alertas, etc. |

### /api/alertas

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/alertas` | Lista de alertas. Filtros: `activa`, `producto_id` |
| GET | `/api/alertas/:id` | Obtener una alerta concreta |
| POST | `/api/alertas` | Crear una alerta. Body: `{ "producto_id", "tipo_alerta", "umbral", "porcentaje_umbral", "email_notificacion" }` |
| PUT | `/api/alertas/:id` | Editar una alerta |
| DELETE | `/api/alertas/:id` | Eliminar una alerta |
| POST | `/api/alertas/:id/activar` | Activar una alerta desactivada |
| POST | `/api/alertas/:id/desactivar` | Desactivar una alerta |
| POST | `/api/alertas/verificar` | Verificar manualmente todas las alertas activas |
| GET | `/api/alertas/estadisticas` | Estadísticas de alertas |
| GET | `/api/alertas/notificaciones` | Historial de notificaciones generadas |

### Sistema

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api` | Información de la API y mapa de todos los endpoints |
| GET | `/api/salud` | Health check: estado de la BD, uptime del servidor, uso de memoria |

---

## Flujo del scraping

![Flujo scraping](public/imgs/flujoScraping.png)
![Flujo scraping](public/imgs/muestra1.png)
![Flujo scraping](public/imgs/muestra2.png)

### Cómo funciona por debajo

Cuando un usuario añade un producto (o cuando el cron lo actualiza automáticamente), esto es lo que pasa:

1. **El usuario pega una URL** de PCComponentes en el interfaz.
2. **Express recibe la petición** `POST /api/productos` con la URL en el body.
3. **ScraperService** es el orquestrador. Instancia el scraper y coordina la lógica.
4. **PuppeteerScraper** lanza un Chrome headless, visita la URL y extrae los datos:
   - **Nombre del producto** — Busca en varios selectores (`h1[data-cy="product-title"]`, `h1.h3`, etc.)
   - **Precio** — Busca en `[data-cy="product-price"]` y fallbacks con regex
   - **Descuento** — Busca el patrón `-XX%` en el HTML, filtrando los que pertenecen a valoraciones
   - **Disponibilidad** — Busca keywords como "agotado", "sin stock" y verifica si existe botón de compra
   - **Imagen** — Busca el selector de imagen del producto, con fallback al img más grande
5. **Se guarda en la base de datos**: primero el producto en `productos`, y luego el precio inicial en `historial_precios`.
6. **El usuario es redirigido** a la página de detalle del producto nuevo.

### Evasión de bloqueos

PCComponentes bloquea los scraping con Axios (peticiones HTTP directas). Por eso el proyecto usa **Puppeteer** con varias medidas de evasión:

- Se lanza Chrome con argumentos que deshabilitan indicadores de automatización (`--disable-blink-features=AutomationControlled`)
- Se sobreescribe `navigator.webdriver` para que no devuelva `true`
- Se simula un User-Agent real de Chrome/Edge
- Se añade un **delay de 2 segundos** tras cargar la página para dejar que el contenido dinámico se renderice

---

## Sistema de alertas

![Tipos de alertas](public/imgs/alertas.png)

### Tipos de alerta

| Tipo | Umbral necesario | Se activa cuando... |
|---|---|---|
| `precio_baja` | Sí (€) | El precio cae por debajo del valor indicado |
| `precio_sube` | Sí (€) | El precio sube por encima del valor indicado |
| `porcentaje_variacion` | Sí (%) | El cambio de precio respecto al anterior supera ese porcentaje |
| `disponibilidad` | No | Un producto que estaba agotado vuelve a estar disponible |
| `agotado` | No | Un producto que estaba disponible se agota |

### Cómo se verifican

Las alertas se verifican de dos formas:

1. **Automáticamente cada 30 minutos** — `AlertasService.verificarTodasLasAlertas()` recorre todas las alertas activas y comprueba la condición contra el último precio registrado.
2. **En tiempo real al actualizar un precio** — Cuando `ScraperService` detecta un cambio de precio, llama a `AlertasService.verificarAlertasDeProducto()` para ese producto concreto. Esto significa que si un precio cambia durante la actualización automática de las 6 horas, la alerta se activa inmediatamente, sin esperar los 30 minutos.

### Notificaciones

Actualmente las notificaciones se **registran en memoria** (array en `AlertasService`). El código ya tiene el esqueleto preparado para integrar un servicio de email real (SendGrid, Nodemailer, AWS SES). Para ver las notificaciones generadas:

```
GET /api/alertas/notificaciones
```

---

## Tareas automáticas (Cron)

El servidor incluye dos tareas programadas gestionadas por `node-cron`:

| Tarea | Expresión Cron | Frecuencia | Qué hace |
|---|---|---|---|
| Actualización de precios | `0 */6 * * *` | Cada 6 horas | Hace scraping de todos los productos activos y registra los cambios |
| Verificación de alertas | `*/30 * * * *` | Cada 30 minutos | Comprueba si alguna alerta activa debe dispararse |

La expresión cron de la actualización de precios se puede cambiar desde la variable de entorno `CRON_SCHEDULE`. Por ejemplo, para que se actualice cada 2 horas:

```env
CRON_SCHEDULE=0 */2 * * *
```

Entre cada producto durante la actualización masiva hay un **delay de 3 segundos** para evitar que PCComponentes bloquee las peticiones por exceso de tráfico.

---

## Variables de entorno

| Variable | Obligatoria | Valor por defecto | Descripción |
|---|---|---|---|
| `PORT` | No | `3000` | Puerto del servidor |
| `NODE_ENV` | No | `development` | Entorno (`development` / `production`) |
| `DB_URL` | **Sí** | — | Connection string de Supabase PostgreSQL |
| `SCRAPE_INTERVAL_MINUTES` | No | `60` | Intervalo de referencia para scraping |
| `USER_AGENT` | No | Chrome 131 | User-Agent que simula Puppeteer |
| `CRON_SCHEDULE` | No | `0 */6 * * *` | Cron de la actualización automática |

El archivo `.env.example` ya contiene todas estas variables a modo de plantilla. Solo tienes que copiar ese archivo a `.env` y rellenar el `DB_URL` con tu connection string de Supabase.

---

## Errores comunes y soluciones

### ❌ "No se pudo conectar a la base de datos"

**Causa más probable:** El `DB_URL` en el `.env` es incorrecto o la contraseña tiene caracteres especiales que necesitan ser URL-encoded.

**Solución:**
1. Comprueba que copiaste el connection string completo desde Supabase.
2. Si tu contraseña tiene caracteres como `@`, `#`, `/`, etc., necesitan estar URL-encoded (por ejemplo `@` → `%40`).
3. Verifica que el proyecto de Supabase esté activo y no suspendido.

### ❌ Puppeteer falla al lanzar Chrome

**Causa más probable:** En entornos de servidor (Linux sin GUI) a veces falta una librería del sistema.

**Solución:** Si estás en producción, asegúrate de que Puppeteer se lanzó con `--no-sandbox`:

```js
// En puppeteerScraper.js, al lanzar el browser
await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
```

### ❌ El scraping no obtiene el precio

**Causa más probable:** PCComponentes puede haber cambiado su estructura HTML.

**Solución:**
1. Visita manualmente la URL del producto en el navegador.
2. Inspecciona el elemento del precio y comprueba si los selectores del scraper coinciden.
3. Actualiza los selectores en `puppeteerScraper.js` si es necesario.

### ❌ "Puerto 3000 ya en uso"

**Solución:** Cambia el puerto en el `.env`:

```env
PORT=3001
```

O mata el proceso que está usando el puerto 3000:

```bash
# macOS / Linux
lsof -ti:3000 | xargs kill -9

# Windows
npx kill-port 3000
```

### ❌ Las tablas no se crean

**Solución:** Ejecuta manualmente el script de inicialización:

```bash
npm run init-db
```

Si sigue fallando, abre la consola de Supabase y ejecuta manualmente el contenido del archivo `database/schema.sql` en el editor SQL de Supabase (Dashboard → SQL Editor).

---

## Notas adicionales

- **El proyecto usa ES Modules** (`"type": "module"` en `package.json`), así que todos los imports son con la sintaxis `import/export`.
- **Las variables de entorno se cargan con `--env-file=.env`** (funcionalidad nativa de Node.js 20+), sin necesidad de usar `dotenv`.
- **El frontend es estático** y se sirve directamente desde la carpeta `public/` a través de Express (`express.static`). No hay bundler ni framework de frontend.
- **El cierre del servidor es graceful**: al hacer Ctrl+C, se cierra correctamente la conexión con la base de datos antes de terminar el proceso.

---

*© 2025 JF Martínez*
