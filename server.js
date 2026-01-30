import express from 'express';
import cors from 'cors';
import db from './src/config/database.js';

// Importar rutas
import productosRoutes from './src/routes/productos.js';
import analyticsRoutes from './src/routes/analytics.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARES
// ============================================
app.use(cors()); // Permitir peticiones desde cualquier origen
app.use(express.json()); // Parsear JSON en el body
// Servir archivos estáticos (frontend)
app.use(express.static('public'));



// Logging de peticiones
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================
// RUTAS DE LA API
// ============================================
app.use('/api/productos', productosRoutes);
app.use('/api/analytics', analyticsRoutes);

// Ruta raíz de la API
app.get('/api', (req, res) => {
  res.json({
    mensaje: 'API de Price Tracker - PCComponentes',
    version: '1.0.0',
    endpoints: {
      productos: '/api/productos',
      analytics: '/api/analytics',
      salud: '/api/salud'
    }
  });
});

// Health check
app.get('/api/salud', async (req, res) => {
  const dbSaludable = await db.testConnection();
  
  res.json({
    estado: dbSaludable ? 'saludable' : 'no saludable',
    baseDatos: dbSaludable ? 'conectada' : 'desconectada',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// MANEJO DE ERRORES
// ============================================
// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    exito: false,
    error: 'Ruta no encontrada'
  });
});

// Error global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    exito: false,
    error: err.message || 'Error interno del servidor'
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const iniciarServidor = async () => {
  try {
    // Verificar conexión a BD
    const dbConectada = await db.testConnection();
    
    if (!dbConectada) {
      console.error('❌ No se pudo conectar a la base de datos');
      process.exit(1);
    }

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(60));
      console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
      console.log(`📚 API disponible en http://localhost:${PORT}/api`);
      console.log(`🌐 Frontend en http://localhost:${PORT}`);
      console.log('='.repeat(60));
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n⏹️ Deteniendo servidor...');
  db.pool.end(() => {
    console.log('✅ Conexiones cerradas');
    process.exit(0);
  });
});

// Iniciar aplicación
iniciarServidor();

export default app;