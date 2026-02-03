import express from 'express';
const router = express.Router();
import comparacionService from '../services/comparacionService.js';
import Producto from '../models/producto.js';

// GET /api/comparacion/:id - Compara el historial de precios interno con fuentes externas
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        exito: false,
        error: 'ID de producto inválido'
      });
    }

    console.log(`\n🔍 Solicitud de comparación para producto ID: ${id}`);

    // Verificar que el producto existe
    const producto = await Producto.obtenerPorId(id);
    if (!producto) {
      return res.status(404).json({
        exito: false,
        error: 'Producto no encontrado'
      });
    }

    // Realizar comparación
    const resultado = await comparacionService.compararConFuentesExternas(id);

    res.json({
      exito: true,
      mensaje: 'Comparación realizada correctamente',
      datos: resultado
    });

  } catch (error) {
    console.error('❌ Error en comparación:', error);
    res.status(500).json({
      exito: false,
      error: error.message || 'Error al realizar la comparación'
    });
  }
});

// GET /api/comparacion/:id/simple - Versión simplificada de la comparación (más rápida)
router.get('/:id/simple', async (req, res) => {
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

    // Solo obtener datos externos sin análisis profundo
    const datosExternos = await comparacionService.obtenerDatosExternos(
      producto.nombre,
      producto.url
    );

    const estadisticas = await Producto.obtenerEstadisticas(id);

    res.json({
      exito: true,
      datos: {
        precioInterno: parseFloat(estadisticas.precio_actual || 0),
        fuentesExternas: datosExternos.fuentes,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error en comparación simple:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// POST /api/comparacion/batch - Compara múltiples productos a la vez
router.post('/batch', async (req, res) => {
  try {
    const { product_ids } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({
        exito: false,
        error: 'Se requiere un array de product_ids'
      });
    }

    if (product_ids.length > 5) {
      return res.status(400).json({
        exito: false,
        error: 'Máximo 5 productos por comparación batch'
      });
    }

    console.log(`\n📊 Comparación batch de ${product_ids.length} productos`);

    const resultados = [];

    for (const id of product_ids) {
      try {
        const resultado = await comparacionService.compararConFuentesExternas(id);
        resultados.push(resultado);
        
        // Delay entre productos para no saturar
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Error en producto ${id}:`, error.message);
        resultados.push({
          producto: { id },
          error: error.message
        });
      }
    }

    res.json({
      exito: true,
      cantidad: resultados.length,
      datos: resultados
    });

  } catch (error) {
    console.error('❌ Error en comparación batch:', error);
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ⚠️ ESTA LÍNEA ES LA QUE FALTABA - MUY IMPORTANTE
export default router;