import express from 'express';
const router = express.Router();
import Alerta from '../models/alertas.js';
import Producto from '../models/producto.js';
import alertasService from '../services/alertasService.js';

// Get /api/alertas - listar todas las alertas
router.get('/', async (req, res) => {
  try {
    const activa = req.query.activa !== undefined ? req.query.activa === 'true' : null;
    const producto_id = req.query.producto_id ? parseInt(req.query.producto_id) : null;

    let alertas;
    
    if (producto_id) {
      if (activa === true) {
        alertas = await Alerta.obtenerActivasPorProducto(producto_id);
      } else {
        alertas = await Alerta.obtenerPorProductoId(producto_id);
      }
    } else if (activa === true) {
      alertas = await Alerta.obtenerTodasActivas();
    } else {
      // Si no se especifican filtros, devolver todas las activas por defecto
      alertas = await Alerta.obtenerTodasActivas();
    }

    res.json({
      exito: true,
      cantidad: alertas.length,
      datos: alertas
    });
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/alertas/estadisticas - estadísticas de alertas
router.get('/estadisticas', async (req, res) => {
  try {
    const estadisticas = await Alerta.obtenerEstadisticas();

    res.json({
      exito: true,
      datos: estadisticas
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/alertas/notificaciones - historial de notificaciones
router.get('/notificaciones', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 50;
    const notificaciones = alertasService.obtenerHistorialNotificaciones(limite);

    res.json({
      exito: true,
      cantidad: notificaciones.length,
      datos: notificaciones
    });
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Post /api/alertas/verificar - verificar todas las alertas manualmente
router.post('/verificar', async (req, res) => {
  try {
    console.log('🔔 Verificación manual de alertas solicitada');
    
    const resultado = await alertasService.verificarTodasLasAlertas();

    res.json({
      exito: true,
      mensaje: 'Verificación completada',
      datos: resultado
    });
  } catch (error) {
    console.error('Error verificando alertas:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/alertas/:id - obtener una alerta específica
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de alerta inválido'
      });
    }

    const alerta = await Alerta.obtenerPorId(id);

    if (!alerta) {
      return res.status(404).json({
        exito: false,
        error: 'Alerta no encontrada'
      });
    }

    res.json({
      exito: true,
      datos: alerta
    });
  } catch (error) {
    console.error('Error obteniendo alerta:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Post /api/alertas - crear una nueva alerta
router.post('/', async (req, res) => {
  try {
    const { 
      producto_id, 
      tipo_alerta, 
      umbral, 
      porcentaje_umbral, 
      email_notificacion 
    } = req.body;

    // Validaciones
    if (!producto_id || !tipo_alerta) {
      return res.status(400).json({
        exito: false,
        error: 'producto_id y tipo_alerta son requeridos'
      });
    }

    // Verificar que el producto existe
    const producto = await Producto.obtenerPorId(producto_id);
    if (!producto) {
      return res.status(404).json({
        exito: false,
        error: 'Producto no encontrado'
      });
    }

    // Validar tipo de alerta
    const tiposValidos = ['precio_baja', 'precio_sube', 'porcentaje_variacion', 'disponibilidad', 'agotado'];
    if (!tiposValidos.includes(tipo_alerta)) {
      return res.status(400).json({
        exito: false,
        error: `Tipo de alerta inválido. Valores permitidos: ${tiposValidos.join(', ')}`
      });
    }

    // Validar que se proporcionen los parámetros necesarios según el tipo
    if ((tipo_alerta === 'precio_baja' || tipo_alerta === 'precio_sube') && !umbral) {
      return res.status(400).json({
        exito: false,
        error: 'Se requiere umbral para alertas de precio'
      });
    }

    if (tipo_alerta === 'porcentaje_variacion' && !porcentaje_umbral) {
      return res.status(400).json({
        exito: false,
        error: 'Se requiere porcentaje_umbral para alertas de variación'
      });
    }

    // Crear alerta
    const alerta = await Alerta.crear({
      producto_id,
      tipo_alerta,
      umbral: umbral || null,
      porcentaje_umbral: porcentaje_umbral || null,
      email_notificacion: email_notificacion || null
    });

    console.log(`✅ Alerta creada: [ID: ${alerta.id}] ${tipo_alerta} para producto ${producto_id}`);

    res.status(201).json({
      exito: true,
      mensaje: 'Alerta creada correctamente',
      datos: alerta
    });
  } catch (error) {
    console.error('Error creando alerta:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Put /api/alertas/:id - actualizar una alerta
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { tipo_alerta, umbral, porcentaje_umbral, activa, email_notificacion } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de alerta inválido'
      });
    }

    const alerta = await Alerta.actualizar(id, {
      tipo_alerta,
      umbral,
      porcentaje_umbral,
      activa,
      email_notificacion
    });

    if (!alerta) {
      return res.status(404).json({
        exito: false,
        error: 'Alerta no encontrada'
      });
    }

    res.json({
      exito: true,
      mensaje: 'Alerta actualizada correctamente',
      datos: alerta
    });
  } catch (error) {
    console.error('Error actualizando alerta:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Delete /api/alertas/:id - eliminar una alerta
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de alerta inválido'
      });
    }

    const alerta = await Alerta.eliminar(id);

    if (!alerta) {
      return res.status(404).json({
        exito: false,
        error: 'Alerta no encontrada'
      });
    }

    res.json({
      exito: true,
      mensaje: 'Alerta eliminada correctamente',
      datos: alerta
    });
  } catch (error) {
    console.error('Error eliminando alerta:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Post /api/alertas/:id/activar - activar una alerta
router.post('/:id/activar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de alerta inválido'
      });
    }

    const alerta = await Alerta.actualizar(id, { activa: true });

    if (!alerta) {
      return res.status(404).json({
        exito: false,
        error: 'Alerta no encontrada'
      });
    }

    res.json({
      exito: true,
      mensaje: 'Alerta activada correctamente',
      datos: alerta
    });
  } catch (error) {
    console.error('Error activando alerta:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Post /api/alertas/:id/desactivar - desactivar una alerta
router.post('/:id/desactivar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de alerta inválido'
      });
    }

    const alerta = await Alerta.actualizar(id, { activa: false });

    if (!alerta) {
      return res.status(404).json({
        exito: false,
        error: 'Alerta no encontrada'
      });
    }

    res.json({
      exito: true,
      mensaje: 'Alerta desactivada correctamente',
      datos: alerta
    });
  } catch (error) {
    console.error('Error desactivando alerta:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

export default router;