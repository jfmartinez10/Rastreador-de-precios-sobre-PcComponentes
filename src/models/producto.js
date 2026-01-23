const db = require('../config/database');

class Producto {
  // Crear un nuevo producto
  static async crear({ nombre, url, tienda, categoria, imagen_url }) {
    const query = `
      INSERT INTO productos (nombre, url, tienda, categoria, imagen_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const valores = [nombre, url, tienda, categoria, imagen_url];
    
    try {
      const resultado = await db.query(query, valores);
      return resultado.rows[0]; // Devuelve el producto creado
    } catch (error) {
      // Error 23505 = URL duplicada (ya existe en la BD)
      if (error.code === '23505') {
        throw new Error('Este producto ya está siendo monitoreado');
      }
      throw error;
    }
  }

  // Obtener todos los productos con filtros y paginación
  static async obtenerTodos({ activo = null, tienda = null, limite = 100, offset = 0 } = {}) {
    let query = `
      SELECT p.*, 
             (SELECT precio FROM historial_precios 
              WHERE producto_id = p.id 
              ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
             (SELECT fecha_captura FROM historial_precios 
              WHERE producto_id = p.id 
              ORDER BY fecha_captura DESC LIMIT 1) as ultima_actualizacion
      FROM productos p
      WHERE 1=1
    `;
    const valores = [];
    let contadorParams = 1;

    // Filtro por activo/inactivo
    if (activo !== null) {
      query += ` AND p.activo = $${contadorParams}`;
      valores.push(activo);
      contadorParams++;
    }

    // Filtro por tienda
    if (tienda) {
      query += ` AND p.tienda = $${contadorParams}`;
      valores.push(tienda);
      contadorParams++;
    }

    // Paginación
    query += ` ORDER BY p.fecha_creacion DESC LIMIT $${contadorParams} OFFSET $${contadorParams + 1}`;
    valores.push(limite, offset);

    const resultado = await db.query(query, valores);
    return resultado.rows;
  }

  // Obtener un producto por su ID
  static async obtenerPorId(id) {
    const query = `
      SELECT p.*,
             (SELECT precio FROM historial_precios 
              WHERE producto_id = p.id 
              ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
             (SELECT disponible FROM historial_precios 
              WHERE producto_id = p.id 
              ORDER BY fecha_captura DESC LIMIT 1) as disponible
      FROM productos p
      WHERE p.id = $1
    `;
    const resultado = await db.query(query, [id]);
    return resultado.rows[0] || null;
  }

  // Actualizar un producto
  static async actualizar(id, { nombre, categoria, imagen_url, activo }) {
    const actualizaciones = [];
    const valores = [];
    let contadorParams = 1;

    // Construir query dinámicamente según qué campos se pasen
    if (nombre !== undefined) {
      actualizaciones.push(`nombre = $${contadorParams}`);
      valores.push(nombre);
      contadorParams++;
    }
    if (categoria !== undefined) {
      actualizaciones.push(`categoria = $${contadorParams}`);
      valores.push(categoria);
      contadorParams++;
    }
    if (imagen_url !== undefined) {
      actualizaciones.push(`imagen_url = $${contadorParams}`);
      valores.push(imagen_url);
      contadorParams++;
    }
    if (activo !== undefined) {
      actualizaciones.push(`activo = $${contadorParams}`);
      valores.push(activo);
      contadorParams++;
    }

    if (actualizaciones.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    valores.push(id);
    const query = `
      UPDATE productos 
      SET ${actualizaciones.join(', ')}
      WHERE id = $${contadorParams}
      RETURNING *
    `;

    const resultado = await db.query(query, valores);
    return resultado.rows[0] || null;
  }

  // Eliminar un producto
  static async eliminar(id) {
    const query = 'DELETE FROM productos WHERE id = $1 RETURNING *';
    const resultado = await db.query(query, [id]);
    return resultado.rows[0] || null;
  }

  // Obtener estadísticas de un producto
  static async obtenerEstadisticas(id) {
    const query = `
      SELECT 
        COUNT(*) as total_registros,
        MIN(precio) as precio_minimo,
        MAX(precio) as precio_maximo,
        AVG(precio) as precio_promedio,
        MIN(fecha_captura) as primer_registro,
        MAX(fecha_captura) as ultimo_registro
      FROM historial_precios
      WHERE producto_id = $1
    `;
    const resultado = await db.query(query, [id]);
    return resultado.rows[0];
  }
}

module.exports = Producto;