import db from '../config/database.js';

class Alerta {
  // Crear una nueva alerta
  static async crear({ producto_id, tipo_alerta, umbral, porcentaje_umbral, email_notificacion }) {
    const query = `
      INSERT INTO alertas (producto_id, tipo_alerta, umbral, porcentaje_umbral, email_notificacion, activa)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `;
    const valores = [producto_id, tipo_alerta, umbral, porcentaje_umbral, email_notificacion];
    
    try {
      const resultado = await db.query(query, valores);
      return resultado.rows[0];
    } catch (error) {
      console.error('Error creando alerta:', error);
      throw error;
    }
  }

  // Obtener todas las alertas de un producto
  static async obtenerPorProductoId(producto_id) {
    const query = `
      SELECT * FROM alertas
      WHERE producto_id = $1
      ORDER BY fecha_creacion DESC
    `;
    const resultado = await db.query(query, [producto_id]);
    return resultado.rows;
  }

  // Obtener alertas activas de un producto
  static async obtenerActivasPorProducto(producto_id) {
    const query = `
      SELECT * FROM alertas
      WHERE producto_id = $1 AND activa = true
      ORDER BY fecha_creacion DESC
    `;
    const resultado = await db.query(query, [producto_id]);
    return resultado.rows;
  }

  // Obtener todas las alertas activas (para verificación periódica)
  static async obtenerTodasActivas() {
    const query = `
      SELECT 
        a.*,
        p.nombre as producto_nombre,
        p.url as producto_url,
        (SELECT precio FROM historial_precios 
         WHERE producto_id = a.producto_id 
         ORDER BY fecha_captura DESC LIMIT 1) as precio_actual,
        (SELECT disponible FROM historial_precios 
         WHERE producto_id = a.producto_id 
         ORDER BY fecha_captura DESC LIMIT 1) as disponible_actual
      FROM alertas a
      INNER JOIN productos p ON a.producto_id = p.id
      WHERE a.activa = true AND p.activo = true
    `;
    const resultado = await db.query(query);
    return resultado.rows;
  }

  // Obtener una alerta por ID
  static async obtenerPorId(id) {
    const query = 'SELECT * FROM alertas WHERE id = $1';
    const resultado = await db.query(query, [id]);
    return resultado.rows[0] || null;
  }

  // Actualizar una alerta
  static async actualizar(id, { tipo_alerta, umbral, porcentaje_umbral, activa, email_notificacion }) {
    const actualizaciones = [];
    const valores = [];
    let contadorParams = 1;

    if (tipo_alerta !== undefined) {
      actualizaciones.push(`tipo_alerta = $${contadorParams}`);
      valores.push(tipo_alerta);
      contadorParams++;
    }
    if (umbral !== undefined) {
      actualizaciones.push(`umbral = $${contadorParams}`);
      valores.push(umbral);
      contadorParams++;
    }
    if (porcentaje_umbral !== undefined) {
      actualizaciones.push(`porcentaje_umbral = $${contadorParams}`);
      valores.push(porcentaje_umbral);
      contadorParams++;
    }
    if (activa !== undefined) {
      actualizaciones.push(`activa = $${contadorParams}`);
      valores.push(activa);
      contadorParams++;
    }
    if (email_notificacion !== undefined) {
      actualizaciones.push(`email_notificacion = $${contadorParams}`);
      valores.push(email_notificacion);
      contadorParams++;
    }

    if (actualizaciones.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    valores.push(id);
    
    const query = `
      UPDATE alertas 
      SET ${actualizaciones.join(', ')}
      WHERE id = $${contadorParams}
      RETURNING *
    `;

    const resultado = await db.query(query, valores);
    return resultado.rows[0] || null;
  }

  // Eliminar una alerta
  static async eliminar(id) {
    const query = 'DELETE FROM alertas WHERE id = $1 RETURNING *';
    const resultado = await db.query(query, [id]);
    return resultado.rows[0] || null;
  }

  // Marcar alerta como activada (última activación)
  static async marcarActivacion(id) {
    const query = `
      UPDATE alertas 
      SET ultima_activacion = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const resultado = await db.query(query, [id]);
    return resultado.rows[0] || null;
  }

  // Desactivar alertas de un producto
  static async desactivarPorProducto(producto_id) {
    const query = `
      UPDATE alertas 
      SET activa = false
      WHERE producto_id = $1
      RETURNING *
    `;
    const resultado = await db.query(query, [producto_id]);
    return resultado.rows;
  }

  // Obtener estadísticas de alertas
  static async obtenerEstadisticas() {
    const query = `
      SELECT 
        COUNT(*) as total_alertas,
        COUNT(*) FILTER (WHERE activa = true) as alertas_activas,
        COUNT(*) FILTER (WHERE activa = false) as alertas_inactivas,
        COUNT(DISTINCT producto_id) as productos_con_alertas,
        COUNT(*) FILTER (WHERE ultima_activacion IS NOT NULL) as alertas_activadas_alguna_vez,
        COUNT(DISTINCT tipo_alerta) as tipos_diferentes
      FROM alertas
    `;
    const resultado = await db.query(query);
    return resultado.rows[0];
  }

  // Verificar si una alerta se debe activar
  static verificarCondicion(alerta, precioActual, precioAnterior, disponibleActual) {
    switch (alerta.tipo_alerta) {
      case 'precio_baja':
        // Alerta cuando el precio baja por debajo del umbral
        if (alerta.umbral && precioActual < alerta.umbral) {
          return {
            activar: true,
            mensaje: `El precio bajó a ${precioActual}€ (umbral: ${alerta.umbral}€)`
          };
        }
        break;

      case 'precio_sube':
        // Alerta cuando el precio sube por encima del umbral
        if (alerta.umbral && precioActual > alerta.umbral) {
          return {
            activar: true,
            mensaje: `El precio subió a ${precioActual}€ (umbral: ${alerta.umbral}€)`
          };
        }
        break;

      case 'porcentaje_variacion':
        // Alerta cuando cambia un porcentaje específico
        if (precioAnterior && alerta.porcentaje_umbral) {
          const variacion = Math.abs(((precioActual - precioAnterior) / precioAnterior) * 100);
          if (variacion >= alerta.porcentaje_umbral) {
            const direccion = precioActual < precioAnterior ? 'bajó' : 'subió';
            return {
              activar: true,
              mensaje: `El precio ${direccion} un ${variacion.toFixed(2)}% (${precioAnterior}€ → ${precioActual}€)`
            };
          }
        }
        break;

      case 'disponibilidad':
        // Alerta cuando vuelve a estar disponible
        if (disponibleActual === true) {
          return {
            activar: true,
            mensaje: `El producto volvió a estar disponible`
          };
        }
        break;

      case 'agotado':
        // Alerta cuando se agota
        if (disponibleActual === false) {
          return {
            activar: true,
            mensaje: `El producto se agotó`
          };
        }
        break;

      default:
        return { activar: false };
    }

    return { activar: false };
  }
}

export default Alerta;