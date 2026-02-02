import Alerta from '../models/alertas.js';
import Producto from '../models/producto.js';
import HistorialPrecios from '../models/historialPrecios.js';

class AlertasService {
  constructor() {
    this.notificacionesEnvidas = [];
  }

  // Verificar todas las alertas activas
  async verificarTodasLasAlertas() {
    try {
      console.log('\n🔔 Verificando alertas activas...');
      
      const alertas = await Alerta.obtenerTodasActivas();
      
      if (alertas.length === 0) {
        console.log('ℹ️  No hay alertas activas para verificar');
        return { alertasVerificadas: 0, alertasActivadas: 0 };
      }

      console.log(`📋 Encontradas ${alertas.length} alertas activas`);
      
      let alertasActivadas = 0;

      for (const alerta of alertas) {
        try {
          const activada = await this.verificarAlerta(alerta);
          if (activada) {
            alertasActivadas++;
          }
        } catch (error) {
          console.error(`❌ Error verificando alerta ${alerta.id}:`, error.message);
        }
      }

      console.log(`✅ Verificación completa: ${alertasActivadas}/${alertas.length} alertas activadas`);
      
      return {
        alertasVerificadas: alertas.length,
        alertasActivadas: alertasActivadas
      };

    } catch (error) {
      console.error('❌ Error verificando alertas:', error);
      throw error;
    }
  }

  // Verificar una alerta específica
  async verificarAlerta(alerta) {
    try {
      // Obtener historial reciente del producto
      const historial = await HistorialPrecios.obtenerPorProductoId(alerta.producto_id, { limite: 2 });
      
      if (historial.length === 0) {
        return false;
      }

      const precioActual = parseFloat(historial[0].precio);
      const disponibleActual = historial[0].disponible;
      const precioAnterior = historial.length > 1 ? parseFloat(historial[1].precio) : null;

      // Verificar si se cumple la condición de la alerta
      const resultado = Alerta.verificarCondicion(
        alerta,
        precioActual,
        precioAnterior,
        disponibleActual
      );

      if (resultado.activar) {
        console.log(`🔔 Alerta activada [ID: ${alerta.id}]`);
        console.log(`   📦 Producto: ${alerta.producto_nombre}`);
        console.log(`   📨 ${resultado.mensaje}`);

        // Enviar notificación
        await this.enviarNotificacion(alerta, resultado.mensaje, {
          precioActual,
          disponibleActual,
          url: alerta.producto_url
        });

        // Marcar como activada
        await Alerta.marcarActivacion(alerta.id);

        return true;
      }

      return false;

    } catch (error) {
      console.error(`Error verificando alerta ${alerta.id}:`, error);
      return false;
    }
  }

  // Verificar alertas de un producto específico (llamado al actualizar precio)
  async verificarAlertasDeProducto(producto_id, precioNuevo, precioAnterior, disponibleNuevo) {
    try {
      const alertas = await Alerta.obtenerActivasPorProducto(producto_id);
      
      if (alertas.length === 0) {
        return { alertasActivadas: 0 };
      }

      console.log(`\n🔔 Verificando ${alertas.length} alerta(s) del producto ${producto_id}`);
      
      let alertasActivadas = 0;

      for (const alerta of alertas) {
        const resultado = Alerta.verificarCondicion(
          alerta,
          precioNuevo,
          precioAnterior,
          disponibleNuevo
        );

        if (resultado.activar) {
          console.log(`✅ Alerta activada: ${resultado.mensaje}`);
          
          const producto = await Producto.obtenerPorId(producto_id);
          
          await this.enviarNotificacion(alerta, resultado.mensaje, {
            precioActual: precioNuevo,
            disponibleActual: disponibleNuevo,
            url: producto.url,
            nombre: producto.nombre
          });

          await Alerta.marcarActivacion(alerta.id);
          alertasActivadas++;
        }
      }

      return { alertasActivadas };

    } catch (error) {
      console.error('Error verificando alertas de producto:', error);
      return { alertasActivadas: 0, error: error.message };
    }
  }

  // Enviar notificación (aquí solo registramos, pero se podría enviar email real)
  async enviarNotificacion(alerta, mensaje, datos) {
    try {
      const notificacion = {
        alerta_id: alerta.id,
        tipo_alerta: alerta.tipo_alerta,
        mensaje: mensaje,
        email: alerta.email_notificacion,
        datos: datos,
        fecha: new Date().toISOString()
      };

      // Registrar notificación
      this.notificacionesEnvidas.push(notificacion);

      console.log(`📧 Notificación registrada:`);
      console.log(`   Destinatario: ${alerta.email_notificacion || 'No especificado'}`);
      console.log(`   Mensaje: ${mensaje}`);
      console.log(`   Producto: ${datos.nombre || 'N/A'}`);
      console.log(`   Precio: ${datos.precioActual}€`);

      // TODO: Aquí se podría integrar un servicio real de email
      // Ejemplos: SendGrid, Nodemailer, AWS SES, etc.
      
      /*
      if (alerta.email_notificacion) {
        await enviarEmail({
          to: alerta.email_notificacion,
          subject: `Alerta de precio: ${datos.nombre}`,
          body: `${mensaje}\n\nPrecio actual: ${datos.precioActual}€\nVer producto: ${datos.url}`
        });
      }
      */

      return true;

    } catch (error) {
      console.error('Error enviando notificación:', error);
      return false;
    }
  }

  // Obtener historial de notificaciones enviadas (en memoria)
  obtenerHistorialNotificaciones(limite = 50) {
    return this.notificacionesEnvidas
      .slice(-limite)
      .reverse();
  }

  // Limpiar historial de notificaciones
  limpiarHistorialNotificaciones() {
    const cantidad = this.notificacionesEnvidas.length;
    this.notificacionesEnvidas = [];
    return { notificacionesEliminadas: cantidad };
  }
}

export default new AlertasService();