import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './src/config/database.js';
import cron from 'node-cron';

// Importar rutas
import productosRoutes from './src/routes/productos.js';
import analyticsRoutes from './src/routes/analytics.js';
import alertasRoutes from './src/routes/alertas.js';
import comparacionRoutes from './src/routes/comparacion.js';
import scraperService from './src/services/scraperService.js';
import alertasService from './src/services/alertasService.js';

// Configuración de __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Logging de peticiones
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleString('es-ES');
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Rutas de la API
app.use('/api/productos', productosRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/comparacion', comparacionRoutes);

// Ruta raíz de la API
app.get('/api', (req, res) => {
  res.json({
    nombre: 'API de PcDrop',
    version: '1.0.0',
    descripcion: 'Sistema de monitorización de precios PcDrop',
    endpoints: {
      productos: {
        listar: 'GET /api/productos',
        destacados: 'GET /api/productos/destacados',
        buscar: 'GET /api/productos/buscar?q=termino',
        obtener: 'GET /api/productos/:id',
        crear: 'POST /api/productos',
        actualizar: 'PUT /api/productos/:id',
        eliminar: 'DELETE /api/productos/:id',
        historial: 'GET /api/productos/:id/historial',
        historial_grafica: 'GET /api/productos/:id/historial-grafica',
        estadisticas: 'GET /api/productos/:id/estadisticas',
        actualizar_precio: 'POST /api/productos/:id/actualizar-precio',
        cambios: 'GET /api/productos/:id/cambios-precio',
        estado_en_fecha: 'GET /api/productos/:id/estado-en-fecha?fecha=YYYY-MM-DD'
      },
      analytics: {
        mejores_ofertas: 'GET /api/analytics/mejores-ofertas',
        alertas: 'GET /api/analytics/alertas-precio',
        tendencias: 'GET /api/analytics/tendencias',
        comparar: 'POST /api/analytics/comparar',
        estadisticas_tienda: 'GET /api/analytics/estadisticas-tienda',
        resumen: 'GET /api/analytics/resumen-general'
      },
      alertas: {
        listar: 'GET /api/alertas',
        obtener: 'GET /api/alertas/:id',
        crear: 'POST /api/alertas',
        actualizar: 'PUT /api/alertas/:id',
        eliminar: 'DELETE /api/alertas/:id',
        activar: 'POST /api/alertas/:id/activar',
        desactivar: 'POST /api/alertas/:id/desactivar',
        verificar: 'POST /api/alertas/verificar',
        estadisticas: 'GET /api/alertas/estadisticas',
        notificaciones: 'GET /api/alertas/notificaciones'
      },
      comparacion: {
        comparar_producto: 'GET /api/comparacion/:id',
        comparar_simple: 'GET /api/comparacion/:id/simple',
        comparar_batch: 'POST /api/comparacion/batch',
        confiabilidad: 'GET /api/comparacion/:id/confiabilidad'
      },
      sistema: {
        salud: 'GET /api/salud',
        info: 'GET /api'
      }
    }
  });
});

// Health check
app.get('/api/salud', async (req, res) => {
  const dbSaludable = await db.testConnection();
  
  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
  
  res.json({
    estado: dbSaludable ? 'saludable' : 'degradado',
    baseDatos: dbSaludable ? 'conectada' : 'desconectada',
    uptime: uptimeFormatted,
    memoria: {
      uso: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    },
    timestamp: new Date().toISOString()
  });
});

// Tarea programada (CRON)
// Actualización automática de precios
const cronSchedule = process.env.CRON_SCHEDULE || '0 */6 * * *'; // Cada 6 horas por defecto

cron.schedule(cronSchedule, async () => {
  console.log('\n🕐 Iniciando actualización programada de precios...');
  try {
    await scraperService.actualizarTodosLosProductos();
  } catch (error) {
    console.error('❌ Error en actualización programada:', error);
  }
});

console.log(`⏰ Tarea de actualización configurada: ${cronSchedule}`);

// Verificación de alertas cada 30 minutos
cron.schedule('*/30 * * * *', async () => {
  console.log('\n🔔 Iniciando verificación programada de alertas...');
  try {
    const resultado = await alertasService.verificarTodasLasAlertas();
    console.log(`✅ Verificación completada: ${resultado.alertasActivadas}/${resultado.alertasVerificadas} alertas activadas`);
  } catch (error) {
    console.error('❌ Error en verificación de alertas:', error);
  }
});

console.log(`🔔 Tarea de alertas configurada: cada 30 minutos`);

// Manejo de errores
// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    exito: false,
    error: 'Ruta no encontrada',
    ruta: req.path
  });
});

// Error global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({
    exito: false,
    error: err.message || 'Error interno del servidor'
  });
});

// Iniciar servidor
const iniciarServidor = async () => {
  try {
    // Verificar conexión a BD
    console.log('\n🔍 Verificando conexión a la base de datos...');
    const dbConectada = await db.testConnection();
    
    if (!dbConectada) {
      console.error('❌ No se pudo conectar a la base de datos');
      console.error('💡 Verifica que PostgreSQL esté ejecutándose y que las credenciales en .env sean correctas');
      process.exit(1);
    }

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(70));
      console.log('🚀 SERVIDOR INICIADO CORRECTAMENTE');
      console.log('='.repeat(70));
      console.log(`📍 Servidor:     http://localhost:${PORT}`);
      console.log(`📚 API:          http://localhost:${PORT}/api`);
      console.log(`🌐 Frontend:     http://localhost:${PORT}`);
      console.log(`💚 Health Check: http://localhost:${PORT}/api/salud`);
      console.log('='.repeat(70));
      console.log(`⏰ Hora actual:  ${new Date().toLocaleString('es-ES')}`);
      console.log(`🗄️  Base de datos: PostgreSQL conectada`);
      console.log(`⚙️  Entorno:      ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(70) + '\n');
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejo de cierre graceful
const cerrarServidor = async () => {
  console.log('\n\n⚠️  Señal de cierre recibida...');
  console.log('🔄 Cerrando conexiones...');
  
  try {
    await db.pool.end();
    console.log('✅ Conexiones de base de datos cerradas');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cerrando conexiones:', error);
    process.exit(1);
  }
};

process.on('SIGINT', cerrarServidor);
process.on('SIGTERM', cerrarServidor);

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

// Iniciar aplicación
iniciarServidor();

export default app;