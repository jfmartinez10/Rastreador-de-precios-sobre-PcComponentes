const express = require('express');
const router = express.Router();
const HistorialPrecios = require('../models/historialPrecios');
const db = require('../config/database');

// ============================================
// POST /api/analytics/comparar - Comparar productos
// ============================================
router.post('/comparar', async (req, res) => {
  try {
    const { product_ids } = req.body;

    if (!product_ids || !Array.isArray(product_ids)) {
      return res.status(400).json({
        exito: false,
        error: 'Se requiere un array de product_ids'
      });
    }

    const comparacion = await HistorialPrecios.compararProductos(product_ids);

    res.json({
      exito: true,
      cantidad: comparacion.length,
      datos: comparacion
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================
// GET /api/analytics/precio-en-fecha - Precio en fecha específica
// ============================================
router.get('/precio-en-fecha', async (req, res) => {
  try {
    const { producto_id, fecha } = req.query;

    if (!producto_id || !fecha) {
      return res.status(400).json({
        exito: false,
        error: 'Se requieren producto_id y fecha'
      });
    }

    // Buscar el precio más cercano a esa fecha
    const query = `
      SELECT * FROM historial_precios
      WHERE producto_id = $1 AND fecha_captura <= $2
      ORDER BY fecha_captura DESC
      LIMIT 1
    `;
    
    const resultado = await db.query(query, [producto_id, fecha]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        error: 'No hay datos disponibles para esa fecha'
      });
    }

    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================
// GET /api/analytics/mejores-ofertas - Mejores descuentos
// ============================================
router.get('/mejores-ofertas', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const limite = parseInt(req.query.limite) || 10;

    const query = `
      WITH comparacion_precios AS (
        SELECT 
          p.id,
          p.nombre,
          p.tienda,
          p.url,
          p.imagen_url,
          FIRST_VALUE(h.precio) OVER (PARTITION BY p.id ORDER BY h.fecha_captura DESC) as precio_actual,
          MAX(h.precio) OVER (PARTITION BY p.id) as precio_maximo,
          MIN(h.precio) OVER (PARTITION BY p.id) as precio_minimo
        FROM productos p
        INNER JOIN historial_precios h ON p.id = h.producto_id
        WHERE p.activo = true
          AND h.fecha_captura >= NOW() - INTERVAL '${dias} days'
      ),
      ofertas AS (
        SELECT DISTINCT ON (id)
          id,
          nombre,
          tienda,
          url,
          imagen_url,
          precio_actual,
          precio_maximo,
          ROUND(((precio_maximo - precio_actual) / precio_maximo * 100)::numeric, 2) as porcentaje_descuento,
          (precio_maximo - precio_actual) as ahorro
        FROM comparacion_precios
        WHERE precio_actual < precio_maximo
      )
      SELECT * FROM ofertas
      ORDER BY porcentaje_descuento DESC
      LIMIT $1
    `;

    const resultado = await db.query(query, [limite]);

    res.json({
      exito: true,
      cantidad: resultado.rows.length,
      datos: resultado.rows
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================
// GET /api/analytics/alertas-precio - Cambios significativos
// ============================================
router.get('/alertas-precio', async (req, res) => {
  try {
    const umbral = parseFloat(req.query.umbral) || 10; // % de cambio
    const horas = parseInt(req.query.horas) || 24;

    const query = `
      WITH precios_recientes AS (
        SELECT 
          p.id,
          p.nombre,
          p.tienda,
          p.url,
          h.precio,
          h.fecha_captura,
          LAG(h.precio) OVER (PARTITION BY p.id ORDER BY h.fecha_captura) as precio_anterior
        FROM productos p
        INNER JOIN historial_precios h ON p.id = h.producto_id
        WHERE h.fecha_captura >= NOW() - INTERVAL '${horas} hours'
      )
      SELECT 
        id,
        nombre,
        tienda,
        url,
        precio as precio_actual,
        precio_anterior,
        (precio - precio_anterior) as cambio_precio,
        ROUND(((precio - precio_anterior) / precio_anterior * 100)::numeric, 2) as porcentaje_cambio,
        fecha_captura
      FROM precios_recientes
      WHERE precio_anterior IS NOT NULL
        AND ABS((precio - precio_anterior) / precio_anterior * 100) >= $1
      ORDER BY ABS((precio - precio_anterior) / precio_anterior * 100) DESC
    `;

    const resultado = await db.query(query, [umbral]);

    res.json({
      exito: true,
      cantidad: resultado.rows.length,
      datos: resultado.rows
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================
// GET /api/analytics/estadisticas-tienda - Stats por tienda
// ============================================
router.get('/estadisticas-tienda', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.tienda,
        COUNT(DISTINCT p.id) as total_productos,
        ROUND(AVG(h.precio)::numeric, 2) as precio_promedio,
        MIN(h.precio) as precio_minimo,
        MAX(h.precio) as precio_maximo,
        COUNT(h.id) as total_registros
      FROM productos p
      LEFT JOIN historial_precios h ON p.id = h.producto_id
      WHERE p.activo = true
      GROUP BY p.tienda
      ORDER BY total_productos DESC
    `;

    const resultado = await db.query(query);

    res.json({
      exito: true,
      cantidad: resultado.rows.length,
      datos: resultado.rows
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================
// GET /api/analytics/tendencias - Productos con más actividad
// ============================================
router.get('/tendencias', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const limite = parseInt(req.query.limite) || 10;

    const query = `
      SELECT 
        p.id,
        p.nombre,
        p.tienda,
        p.url,
        p.imagen_url,
        COUNT(h.id) as cambios_precio,
        MAX(h.precio) - MIN(h.precio) as rango_precio,
        ROUND(AVG(h.precio)::numeric, 2) as precio_promedio
      FROM productos p
      INNER JOIN historial_precios h ON p.id = h.producto_id
      WHERE h.fecha_captura >= NOW() - INTERVAL '${dias} days'
        AND p.activo = true
      GROUP BY p.id, p.nombre, p.tienda, p.url, p.imagen_url
      HAVING COUNT(h.id) > 1
      ORDER BY cambios_precio DESC, rango_precio DESC
      LIMIT $1
    `;

    const resultado = await db.query(query, [limite]);

    res.json({
      exito: true,
      cantidad: resultado.rows.length,
      datos: resultado.rows
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

module.exports = router;