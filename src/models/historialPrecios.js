import db from '../config/database.js';

class HistorialPrecios {
  // Registrar un nuevo precio
  static async crear({ producto_id, precio, moneda = 'EUR', disponible = true, estado_stock, porcentaje_descuento = null }) {
    const query = `
      INSERT INTO historial_precios (producto_id, precio, moneda, disponible, estado_stock, porcentaje_descuento)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const valores = [producto_id, precio, moneda, disponible, estado_stock, porcentaje_descuento];
    const resultado = await db.query(query, valores);
    return resultado.rows[0];
  }

  // Obtener historial de un producto con filtros
  static async obtenerPorProductoId(producto_id, { 
    limite = 100, 
    offset = 0, 
    fecha_inicio = null, 
    fecha_fin = null,
    periodo = null // '3months', '6months', '1year', 'all'
  } = {}) {
    let query = `
      SELECT * FROM historial_precios
      WHERE producto_id = $1
    `;
    const valores = [producto_id];
    let contadorParams = 2;

    // Filtro por periodo predefinido
    if (periodo) {
      let intervalo;
      switch(periodo) {
        case '3months':
          intervalo = '3 months';
          break;
        case '6months':
          intervalo = '6 months';
          break;
        case '1year':
          intervalo = '1 year';
          break;
        default:
          intervalo = null;
      }
      
      if (intervalo) {
        query += ` AND fecha_captura >= NOW() - INTERVAL '${intervalo}'`;
      }
    }

    // Filtro por rango de fechas personalizado
    if (fecha_inicio && !periodo) {
      query += ` AND fecha_captura >= $${contadorParams}`;
      valores.push(fecha_inicio);
      contadorParams++;
    }

    if (fecha_fin && !periodo) {
      query += ` AND fecha_captura <= $${contadorParams}`;
      valores.push(fecha_fin);
      contadorParams++;
    }

    query += ` ORDER BY fecha_captura DESC LIMIT $${contadorParams} OFFSET $${contadorParams + 1}`;
    valores.push(limite, offset);

    const resultado = await db.query(query, valores);
    return resultado.rows;
  }

  // Obtener historial agrupado para gráficas
  static async obtenerHistorialGrafica(producto_id, periodo = 'all') {
    let whereClause = '';
    
    switch(periodo) {
      case '3months':
        whereClause = "AND fecha_captura >= NOW() - INTERVAL '3 months'";
        break;
      case '6months':
        whereClause = "AND fecha_captura >= NOW() - INTERVAL '6 months'";
        break;
      case '1year':
        whereClause = "AND fecha_captura >= NOW() - INTERVAL '1 year'";
        break;
      default:
        whereClause = '';
    }

    const query = `
      SELECT 
        DATE(fecha_captura) as fecha,
        ROUND(AVG(precio)::numeric, 2) as precio_promedio,
        MIN(precio) as precio_min,
        MAX(precio) as precio_max,
        COUNT(*) as num_registros
      FROM historial_precios
      WHERE producto_id = $1 ${whereClause}
      GROUP BY DATE(fecha_captura)
      ORDER BY fecha ASC
    `;
    
    const resultado = await db.query(query, [producto_id]);
    return resultado.rows;
  }

  // Obtener el último precio registrado
  static async obtenerUltimo(producto_id) {
    const query = `
      SELECT * FROM historial_precios
      WHERE producto_id = $1
      ORDER BY fecha_captura DESC
      LIMIT 1
    `;
    const resultado = await db.query(query, [producto_id]);
    return resultado.rows[0] || null;
  }

  // Detectar cambios de precio significativos
  static async detectarCambiosDePrecios(producto_id, dias = 7) {
    const query = `
      WITH cambios_precio AS (
        SELECT 
          fecha_captura,
          precio,
          LAG(precio) OVER (ORDER BY fecha_captura) as precio_anterior,
          precio - LAG(precio) OVER (ORDER BY fecha_captura) as diferencia_precio,
          ROUND(((precio - LAG(precio) OVER (ORDER BY fecha_captura)) / 
                 LAG(precio) OVER (ORDER BY fecha_captura) * 100)::numeric, 2) as porcentaje_cambio
        FROM historial_precios
        WHERE producto_id = $1 
          AND fecha_captura >= NOW() - INTERVAL '${dias} days'
        ORDER BY fecha_captura
      )
      SELECT * FROM cambios_precio
      WHERE precio_anterior IS NOT NULL
        AND diferencia_precio != 0
      ORDER BY fecha_captura DESC
    `;
    const resultado = await db.query(query, [producto_id]);
    return resultado.rows;
  }

  // Comparar precios entre varios productos
  static async compararProductos(product_ids) {
    const query = `
      SELECT 
        p.id,
        p.nombre,
        p.tienda,
        p.imagen_url,
        h.precio as precio_actual,
        h.disponible,
        h.fecha_captura as ultima_actualizacion
      FROM productos p
      LEFT JOIN LATERAL (
        SELECT precio, disponible, fecha_captura
        FROM historial_precios
        WHERE producto_id = p.id
        ORDER BY fecha_captura DESC
        LIMIT 1
      ) h ON true
      WHERE p.id = ANY($1)
      ORDER BY h.precio ASC NULLS LAST
    `;
    const resultado = await db.query(query, [product_ids]);
    return resultado.rows;
  }

  // Obtener estadísticas rápidas del historial
  static async obtenerEstadisticasRapidas(producto_id) {
    const query = `
      SELECT 
        COUNT(*) as total_registros,
        MIN(precio) as precio_minimo,
        MAX(precio) as precio_maximo,
        ROUND(AVG(precio)::numeric, 2) as precio_promedio,
        (SELECT precio FROM historial_precios WHERE producto_id = $1 ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
        (SELECT precio FROM historial_precios WHERE producto_id = $1 ORDER BY fecha_captura ASC LIMIT 1) as precio_inicial
      FROM historial_precios
      WHERE producto_id = $1
    `;
    const resultado = await db.query(query, [producto_id]);
    return resultado.rows[0];
  }
}

export default HistorialPrecios;