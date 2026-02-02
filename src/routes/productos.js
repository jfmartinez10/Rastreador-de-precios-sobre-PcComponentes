import express from 'express';
const router = express.Router();
import Producto from '../models/producto.js';
import HistorialPrecios from '../models/historialPrecios.js';
import scraperService from '../services/scraperService.js';

// Get /api/productos - listar todos los productos
router.get('/', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const activo = req.query.activo !== undefined ? req.query.activo === 'true' : true;
    const tienda = req.query.tienda || null;

    const productos = await Producto.obtenerTodos({
      activo,
      tienda,
      limite,
      offset
    });

    const total = await Producto.contarTodos({ activo, tienda });

    res.json({
      exito: true,
      cantidad: productos.length,
      total: total,
      pagina: Math.floor(offset / limite) + 1,
      total_paginas: Math.ceil(total / limite),
      datos: productos
    });
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/productos/destacados - productos destacados
router.get('/destacados', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 5;
    const productos = await Producto.obtenerDestacados(limite);

    res.json({
      exito: true,
      cantidad: productos.length,
      datos: productos
    });
  } catch (error) {
    console.error('Error obteniendo destacados:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/productos/buscar - buscar productos
router.get('/buscar', async (req, res) => {
  try {
    const termino = req.query.q || '';
    const limite = parseInt(req.query.limite) || 20;

    if (!termino || termino.trim().length < 2) {
      return res.status(400).json({
        exito: false,
        error: 'Se requiere un término de búsqueda de al menos 2 caracteres'
      });
    }

    const productos = await Producto.buscar(termino, limite);

    res.json({
      exito: true,
      cantidad: productos.length,
      termino: termino,
      datos: productos
    });
  } catch (error) {
    console.error('Error buscando productos:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/productos/:id - obtener un producto
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    const producto = await Producto.obtenerPorId(id);

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
    console.error('Error obteniendo producto:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Post /api/productos - crear/añadir producto
router.post('/', async (req, res) => {
  try {
    const { url, categoria } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({
        exito: false,
        error: 'La URL es requerida'
      });
    }

    if (!url.includes('pccomponentes.com')) {
      return res.status(400).json({
        exito: false,
        error: 'La URL debe ser de PCComponentes'
      });
    }

    // Verificar si ya existe
    const existente = await Producto.obtenerPorUrl(url);
    if (existente) {
      return res.json({
        exito: true,
        yaExistia: true,
        mensaje: 'Este producto ya está siendo monitoreado',
        datos: {
          producto: existente
        }
      });
    }

    // Añadir producto usando el servicio de scraping
    const resultado = await scraperService.añadirProducto(url, categoria);

    res.status(201).json({
      exito: true,
      yaExistia: false,
      mensaje: 'Producto añadido correctamente',
      datos: resultado
    });
  } catch (error) {
    console.error('Error añadiendo producto:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al añadir el producto'
    });
  }
});

// Put /api/productos/:id - actualizar producto
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, categoria, imagen_url, activo } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    const producto = await Producto.actualizar(id, {
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
    console.error('Error actualizando producto:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Delete /api/productos/:id - eliminar producto
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    const producto = await Producto.eliminar(id);

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
    console.error('Error eliminando producto:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/productos/:id/historial - historial de precios
router.get('/:id/historial', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const limite = parseInt(req.query.limite) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const periodo = req.query.periodo || null;

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    const historial = await HistorialPrecios.obtenerPorProductoId(id, {
      limite,
      offset,
      periodo
    });

    res.json({
      exito: true,
      cantidad: historial.length,
      datos: historial
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/productos/:id/historial-grafica - historial para gráficas
router.get('/:id/historial-grafica', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const periodo = req.query.periodo || 'all';

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    const historial = await HistorialPrecios.obtenerHistorialGrafica(id, periodo);

    res.json({
      exito: true,
      cantidad: historial.length,
      periodo: periodo,
      datos: historial
    });
  } catch (error) {
    console.error('Error obteniendo historial para gráfica:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/productos/:id/estadisticas - estadísticas del producto
router.get('/:id/estadisticas', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    const estadisticas = await Producto.obtenerEstadisticas(id);

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

// Post /api/productos/:id/actualizar-precio - forzar actualización
router.post('/:id/actualizar-precio', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    const producto = await Producto.obtenerPorId(id);
    if (!producto) {
      return res.status(404).json({
        exito: false,
        error: 'Producto no encontrado'
      });
    }

    const resultado = await scraperService.actualizarPrecioProducto(producto);

    res.json({
      exito: true,
      mensaje: resultado.actualizado ? 'Precio actualizado' : 'Sin cambios',
      datos: resultado
    });
  } catch (error) {
    console.error('Error actualizando precio:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// Get /api/productos/:id/cambios-precio - cambios de precio
router.get('/:id/cambios-precio', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const dias = parseInt(req.query.dias) || 7;

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    const cambios = await HistorialPrecios.detectarCambiosDePrecios(id, dias);

    res.json({
      exito: true,
      cantidad: cambios.length,
      dias: dias,
      datos: cambios
    });
  } catch (error) {
    console.error('Error obteniendo cambios de precio:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

export default router;