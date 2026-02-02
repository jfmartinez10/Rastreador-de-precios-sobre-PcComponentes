import express from 'express';
const router = express.Router();
import HistorialPrecios from '../models/historialPrecios.js';
import db from '../config/database.js';

// Get /api/analytics/mejores-ofertas - mejores descuentos
router.get('/mejores-ofertas', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const minDescuento = parseFloat(req.query.min_descuento) || 30; 

    console.log(`🔍 Buscando ofertas >= ${minDescuento}%: limite=${limite}, offset=${offset}`);

    // Query usando el porcentaje_descuento REAL de la base de datos
    const queryOfertas = `
      WITH ultimo_precio AS (
        SELECT DISTINCT ON (producto_id)
          producto_id,
          precio,
          porcentaje_descuento,
          fecha_captura
        FROM historial_precios
        ORDER BY producto_id, fecha_captura DESC
      )
      SELECT 
        p.id,
        p.nombre,
        p.tienda,
        p.url,
        p.imagen_url,
        up.precio as precio_actual,
        up.porcentaje_descuento,
        COUNT(*) OVER() as total_count
      FROM productos p
      INNER JOIN ultimo_precio up ON p.id = up.producto_id
      WHERE p.activo = true
        AND up.porcentaje_descuento IS NOT NULL
        AND up.porcentaje_descuento >= $2
      ORDER BY up.porcentaje_descuento DESC
      LIMIT $1 OFFSET $3
    `;

    const resultado = await db.query(queryOfertas, [limite, minDescuento, offset]);
    const total = resultado.rows.length > 0 ? parseInt(resultado.rows[0].total_count) : 0;

    console.log(`✅ Ofertas encontradas: ${resultado.rows.length} (>= ${minDescuento}%)`);

    res.json({
      exito: true,
      cantidad: resultado.rows.length,
      total: total,
      minDescuento: minDescuento,
      datos: resultado.rows
    });
  } catch (error) {
    console.error('❌ Error obteniendo mejores ofertas:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/analytics/alertas-precio - cambios significativos
router.get('/alertas-precio', async (req, res) => {
  try {
    const umbral = parseFloat(req.query.umbral) || 10;
    const horas = parseInt(req.query.horas) || 24;

    const query = `
      WITH precios_recientes AS (
        SELECT 
          p.id,
          p.nombre,
          p.tienda,
          p.url,
          p.imagen_url,
          h.precio,
          h.fecha_captura,
          LAG(h.precio) OVER (PARTITION BY p.id ORDER BY h.fecha_captura) as precio_anterior
        FROM productos p
        INNER JOIN historial_precios h ON p.id = h.producto_id
        WHERE h.fecha_captura >= NOW() - INTERVAL '${horas} hours'
          AND p.activo = true
      )
      SELECT 
        id,
        nombre,
        tienda,
        url,
        imagen_url,
        precio as precio_actual,
        precio_anterior,
        ROUND((precio - precio_anterior)::numeric, 2) as cambio_precio,
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
      umbral: umbral,
      horas: horas,
      datos: resultado.rows
    });
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/analytics/tendencias - productos con más actividad
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
        ROUND((MAX(h.precio) - MIN(h.precio))::numeric, 2) as rango_precio,
        ROUND(AVG(h.precio)::numeric, 2) as precio_promedio,
        MIN(h.precio) as precio_minimo,
        MAX(h.precio) as precio_maximo
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
      dias: dias,
      datos: resultado.rows
    });
  } catch (error) {
    console.error('Error obteniendo tendencias:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Post /api/analytics/comparar - comparar productos
router.post('/comparar', async (req, res) => {
  try {
    const { product_ids } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
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
    console.error('Error comparando productos:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/analytics/estadisticas-tienda - stats por tienda
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
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/analytics/resumen-general - resumen del sistema
router.get('/resumen-general', async (req, res) => {
  try {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM productos WHERE activo = true) as total_productos,
        (SELECT COUNT(*) FROM historial_precios) as total_registros,
        (SELECT COUNT(*) FROM historial_precios WHERE fecha_captura >= NOW() - INTERVAL '24 hours') as registros_24h,
        (SELECT ROUND(AVG(precio)::numeric, 2) FROM historial_precios) as precio_promedio_global,
        (SELECT MIN(precio) FROM historial_precios) as precio_minimo_global,
        (SELECT MAX(precio) FROM historial_precios) as precio_maximo_global
    `;

    const resultado = await db.query(query);

    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error obteniendo resumen:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

export default router;