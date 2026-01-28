const express = require('express');
const router = express.Router();
const Producto = require('../models/producto');
const HistorialPrecios = require('../models/historialPrecios');
const scraperService = require('../services/scraperService');

// Listar todos los productos
router.get('/', async (req, res) => {
  try {
    const { activo, tienda, limite, offset } = req.query;
    
    const productos = await Producto.obtenerTodos({
      activo: activo === 'true' ? true : activo === 'false' ? false : null,
      tienda: tienda,
      limite: parseInt(limite) || 100,
      offset: parseInt(offset) || 0
    });

    res.json({
      exito: true,
      cantidad: productos.length,
      datos: productos
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Obtener un producto específico
router.get('/:id', async (req, res) => {
  try {
    const producto = await Producto.obtenerPorId(req.params.id);
    
    if (!producto) {
      return res.status(404).json({
        exito: false,
        error: 'Producto no encontrado'
      });
    }

    res.json({
      exito: true,
      datos: producto
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Añadir nuevo producto
router.post('/', async (req, res) => {
  try {
    const { url, categoria } = req.body;

    if (!url) {
      return res.status(400).json({
        exito: false,
        error: 'La URL del producto es obligatoria'
      });
    }

    // Validar que sea de PCComponentes
    if (!url.includes('pccomponentes.com')) {
      return res.status(400).json({
        exito: false,
        error: 'La URL debe ser de PCComponentes'
      });
    }

    const resultado = await scraperService.añadirProducto(url, categoria);

    res.status(201).json({
      exito: true,
      mensaje: 'Producto añadido correctamente',
      datos: resultado
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Actualizar producto
router.put('/:id', async (req, res) => {
  try {
    const { nombre, categoria, imagen_url, activo } = req.body;
    
    const producto = await Producto.actualizar(req.params.id, {
      nombre,
      categoria,
      imagen_url,
      activo
    });

    if (!producto) {
      return res.status(404).json({
        exito: false,
        error: 'Producto no encontrado'
      });
    }

    res.json({
      exito: true,
      mensaje: 'Producto actualizado correctamente',
      datos: producto
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Eliminar producto
router.delete('/:id', async (req, res) => {
  try {
    const producto = await Producto.eliminar(req.params.id);

    if (!producto) {
      return res.status(404).json({
        exito: false,
        error: 'Producto no encontrado'
      });
    }

    res.json({
      exito: true,
      mensaje: 'Producto eliminado correctamente',
      datos: producto
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Obtener histórico de precios
router.get('/:id/historial', async (req, res) => {
  try {
    const { limite, offset, fecha_inicio, fecha_fin } = req.query;

    const historial = await HistorialPrecios.obtenerPorProductoId(req.params.id, {
      limite: parseInt(limite) || 100,
      offset: parseInt(offset) || 0,
      fecha_inicio: fecha_inicio,
      fecha_fin: fecha_fin
    });

    res.json({
      exito: true,
      cantidad: historial.length,
      datos: historial
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Obtener estadísticas
router.get('/:id/estadisticas', async (req, res) => {
  try {
    const stats = await Producto.obtenerEstadisticas(req.params.id);

    res.json({
      exito: true,
      datos: stats
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Forzar actualización
router.post('/:id/actualizar-precio', async (req, res) => {
  try {
    const producto = await Producto.obtenerPorId(req.params.id);

    if (!producto) {
      return res.status(404).json({
        exito: false,
        error: 'Producto no encontrado'
      });
    }

    const resultado = await scraperService.actualizarPrecioProducto(producto);

    res.json({
      exito: true,
      mensaje: 'Precio actualizado',
      datos: resultado
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Detectar cambios
router.get('/:id/cambios-precio', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const cambios = await HistorialPrecios.detectarCambiosDePrecios(req.params.id, dias);

    res.json({
      exito: true,
      cantidad: cambios.length,
      datos: cambios
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

module.exports = router;