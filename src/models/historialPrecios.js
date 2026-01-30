import db from '../config/database.js';

class HistorialPrecios {
  // Registra un nuevo precio
  static async crear({ producto_id, precio, moneda = 'EUR', disponible = true, estado_stock }) {
    const query = `
      INSERT INTO historial_precios (producto_id, precio, moneda, disponible, estado_stock)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const valores = [producto_id, precio, moneda, disponible, estado_stock];
    const resultado = await db.query(query, valores);
    return resultado.rows[0];
  }

  // Obtiene el historial de un producto
  static async obtenerPorProductoId(producto_id, { 
    limite = 100, 
    offset = 0, 
    fecha_inicio = null, 
    fecha_fin = null 
  } = {}) {
    let query = `
      SELECT * FROM historial_precios
      WHERE producto_id = $1
    `;
    const valores = [producto_id];
    let contadorParams = 2;

    // Filtro por rango de fechas
    if (fecha_inicio) {
      query += ` AND fecha_captura >= $${contadorParams}`;
      valores.push(fecha_inicio);
      contadorParams++;
    }

    if (fecha_fin) {
      query += ` AND fecha_captura <= $${contadorParams}`;
      valores.push(fecha_fin);
      contadorParams++;
    }

    query += ` ORDER BY fecha_captura DESC LIMIT $${contadorParams} OFFSET $${contadorParams + 1}`;
    valores.push(limite, offset);

    const resultado = await db.query(query, valores);
    return resultado.rows;
  }

  // Obtiene el último precio registrado
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

  // Detecta cambios de precio
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

  // Compara precios entre productos
  static async compararProductos(product_ids) {
    const query = `
      SELECT 
        p.id,
        p.nombre,
        p.tienda,
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
}

export default HistorialPrecios;