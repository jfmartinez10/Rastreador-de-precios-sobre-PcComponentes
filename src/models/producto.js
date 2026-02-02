import db from '../config/database.js';

class Producto {
  // Crear un nuevo producto
  static async crear({ nombre, url, tienda, categoria, imagen_url }) {
    const query = `
      INSERT INTO productos (nombre, url, tienda, categoria, imagen_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const valores = [nombre, url, tienda || 'PCComponentes', categoria, imagen_url];
    
    try {
      const resultado = await db.query(query, valores);
      return resultado.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Este producto ya está siendo monitoreado');
      }
      throw error;
    }
  }

  // Obtener todos los productos con paginación
  static async obtenerTodos({ activo = null, tienda = null, limite = 100, offset = 0 } = {}) {
    let query = `
      SELECT 
        p.*,
        (SELECT precio FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
        (SELECT porcentaje_descuento FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as porcentaje_descuento,
        (SELECT fecha_captura FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as ultima_actualizacion,
        (SELECT disponible FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as disponible
      FROM productos p
      WHERE 1=1
    `;
    const valores = [];
    let contadorParams = 1;

    if (activo !== null) {
      query += ` AND p.activo = $${contadorParams}`;
      valores.push(activo);
      contadorParams++;
    }

    if (tienda) {
      query += ` AND p.tienda = $${contadorParams}`;
      valores.push(tienda);
      contadorParams++;
    }

    query += ` ORDER BY p.fecha_creacion DESC LIMIT $${contadorParams} OFFSET $${contadorParams + 1}`;
    valores.push(limite, offset);

    const resultado = await db.query(query, valores);
    return resultado.rows;
  }

  // Contar total de productos con filtros
  static async contarTodos({ activo = null, tienda = null } = {}) {
    let query = 'SELECT COUNT(*) as total FROM productos p WHERE 1=1';
    const valores = [];
    let contadorParams = 1;

    if (activo !== null) {
      query += ` AND p.activo = $${contadorParams}`;
      valores.push(activo);
      contadorParams++;
    }

    if (tienda) {
      query += ` AND p.tienda = $${contadorParams}`;
      valores.push(tienda);
      contadorParams++;
    }

    const resultado = await db.query(query, valores);
    return parseInt(resultado.rows[0].total);
  }

  // Obtener productos destacados (más vistos/más actualizados)
  static async obtenerDestacados(limite = 5) {
    const query = `
      SELECT 
        p.*,
        (SELECT precio FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
        (SELECT porcentaje_descuento FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as porcentaje_descuento,
        (SELECT disponible FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as disponible,
        COUNT(h.id) as num_actualizaciones
      FROM productos p
      LEFT JOIN historial_precios h ON p.id = h.producto_id
      WHERE p.activo = true
      GROUP BY p.id, p.fecha_creacion
      ORDER BY num_actualizaciones DESC, p.fecha_creacion DESC
      LIMIT $1
    `;
    const resultado = await db.query(query, [limite]);
    return resultado.rows;
  }

  // Obtener un producto por ID
  static async obtenerPorId(id) {
    const query = `
      SELECT 
        p.*,
        (SELECT precio FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
        (SELECT porcentaje_descuento FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as porcentaje_descuento,
        (SELECT disponible FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as disponible
      FROM productos p
      WHERE p.id = $1
    `;
    const resultado = await db.query(query, [id]);
    return resultado.rows[0] || null;
  }

  // Obtener un producto por URL
  static async obtenerPorUrl(url) {
    const query = 'SELECT * FROM productos WHERE url = $1';
    const resultado = await db.query(query, [url]);
    return resultado.rows[0] || null;
  }

  // Actualizar un producto
  static async actualizar(id, { nombre, categoria, imagen_url, activo }) {
    const actualizaciones = [];
    const valores = [];
    let contadorParams = 1;

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

    actualizaciones.push(`fecha_actualizacion = CURRENT_TIMESTAMP`);
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
        ROUND(AVG(precio)::numeric, 2) as precio_promedio,
        MIN(fecha_captura) as primer_registro,
        MAX(fecha_captura) as ultimo_registro,
        (SELECT precio FROM historial_precios WHERE producto_id = $1 ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
        (SELECT porcentaje_descuento FROM historial_precios WHERE producto_id = $1 ORDER BY fecha_captura DESC LIMIT 1) as porcentaje_descuento
      FROM historial_precios
      WHERE producto_id = $1
    `;
    const resultado = await db.query(query, [id]);
    return resultado.rows[0];
  }

  // Buscar productos por nombre
  static async buscar(termino, limite = 20) {
    const query = `
      SELECT 
        p.*,
        (SELECT precio FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
        (SELECT porcentaje_descuento FROM historial_precios 
         WHERE producto_id = p.id 
         ORDER BY fecha_captura DESC LIMIT 1) as porcentaje_descuento
      FROM productos p
      WHERE p.activo = true 
        AND p.nombre ILIKE $1
      ORDER BY p.fecha_creacion DESC
      LIMIT $2
    `;
    const resultado = await db.query(query, [`%${termino}%`, limite]);
    return resultado.rows;
  }
}

export default Producto;