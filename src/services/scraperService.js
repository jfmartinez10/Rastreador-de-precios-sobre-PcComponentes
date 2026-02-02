
import PuppeteerScraper from '../scrapers/puppeteerScraper.js';
import Producto from '../models/producto.js';
import HistorialPrecios from '../models/historialPrecios.js';
import alertasService from './alertasService.js';

class ScraperService {
  constructor() {
    // Usar Puppeteer por defecto porque PCComponentes bloquea Axios
    this.scraper = new PuppeteerScraper();
    // Usar Puppeteer por defecto
    this.scraper = new PuppeteerScraper();
  }

  async añadirProducto(url, categoria = null) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 Iniciando scraping de nuevo producto`);
      console.log(`📍 URL: ${url}`);
      console.log(`${'='.repeat(60)}\n`);

      // Realizar scraping inicial
      const datosScrap = await this.scraper.scrape(url);

      // Crear producto en la base de datos
      const producto = await Producto.crear({
        nombre: datosScrap.nombre,
        url: url,
        tienda: datosScrap.tienda,
        categoria: categoria,
        imagen_url: datosScrap.imagen_url
      });

      console.log(`✅ Producto creado con ID: ${producto.id}`);

      // Registrar precio inicial con porcentaje de descuento
      if (datosScrap.precio !== null) {
        await HistorialPrecios.crear({
          producto_id: producto.id,
          precio: datosScrap.precio,
          moneda: datosScrap.moneda,
          disponible: datosScrap.disponible,
          estado_stock: datosScrap.estado_stock,
          porcentaje_descuento: datosScrap.porcentaje_descuento || null
        });
        console.log(`💰 Precio inicial registrado: ${datosScrap.precio}€`);
        if (datosScrap.porcentaje_descuento) {
          console.log(`🏷️  Descuento: ${datosScrap.porcentaje_descuento}%`);
        }
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ Producto añadido exitosamente`);
      console.log(`${'='.repeat(60)}\n`);

      return {
        producto,
        precioInicial: datosScrap.precio,
        descuento: datosScrap.porcentaje_descuento,
        disponible: datosScrap.disponible
      };

    } catch (error) {
      console.error('\n❌ Error añadiendo producto:', error.message);
      throw error;
    }
  }

  async actualizarPrecioProducto(producto) {
    try {
      console.log(`\n🔄 Actualizando: ${producto.nombre.substring(0, 50)}...`);

      // Realizar scraping
      const datosScrap = await this.scraper.scrape(producto.url);
      
      // Obtener último precio registrado
      const ultimoPrecio = await HistorialPrecios.obtenerUltimo(producto.id);

      // Verificar si hubo cambios
      const precioCambio = !ultimoPrecio || ultimoPrecio.precio !== datosScrap.precio;
      const disponibilidadCambio = !ultimoPrecio || ultimoPrecio.disponible !== datosScrap.disponible;
      const descuentoCambio = !ultimoPrecio || ultimoPrecio.porcentaje_descuento !== datosScrap.porcentaje_descuento;

      if (precioCambio || disponibilidadCambio || descuentoCambio) {
        await HistorialPrecios.crear({
          producto_id: producto.id,
          precio: datosScrap.precio,
          moneda: datosScrap.moneda,
          disponible: datosScrap.disponible,
          estado_stock: datosScrap.estado_stock,
          porcentaje_descuento: datosScrap.porcentaje_descuento || null
        });

        const precioAnterior = ultimoPrecio?.precio || 'N/A';
        const diferencia = ultimoPrecio ? (datosScrap.precio - ultimoPrecio.precio).toFixed(2) : 'N/A';
        const signo = diferencia > 0 ? '+' : '';
        
        console.log(`✅ Actualizado: ${precioAnterior}€ → ${datosScrap.precio}€ (${signo}${diferencia}€)`);
        if (datosScrap.porcentaje_descuento) {
          console.log(`🏷️  Descuento actual: ${datosScrap.porcentaje_descuento}%`);
        }

        // Verificar alertas cuando hay cambios
        if (precioCambio || disponibilidadCambio) {
          try {
            const resultadoAlertas = await alertasService.verificarAlertasDeProducto(
              producto.id,
              datosScrap.precio,
              ultimoPrecio?.precio,
              datosScrap.disponible
            );
            
            if (resultadoAlertas.alertasActivadas > 0) {
              console.log(`🔔 ${resultadoAlertas.alertasActivadas} alerta(s) activada(s)`);
            }
          } catch (errorAlertas) {
            console.error(`⚠️  Error verificando alertas:`, errorAlertas.message);
          }
        }

        return {
          actualizado: true,
          precioAnterior: ultimoPrecio?.precio,
          precioNuevo: datosScrap.precio,
          descuento: datosScrap.porcentaje_descuento,
          diferencia: diferencia !== 'N/A' ? parseFloat(diferencia) : null,
          cambioPrecio: precioCambio,
          cambioDisponibilidad: disponibilidadCambio,
          cambioDescuento: descuentoCambio
        };
      }

      console.log(`ℹ️ Sin cambios`);
      return { actualizado: false };

    } catch (error) {
      console.error(`❌ Error actualizando ${producto.nombre}:`, error.message);
      return { 
        actualizado: false, 
        error: error.message 
      };
    }
  }

  async actualizarTodosLosProductos() {
    try {
      const productos = await Producto.obtenerTodos({ activo: true });
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Iniciando actualización masiva de ${productos.length} productos`);
      console.log(`⏰ ${new Date().toLocaleString('es-ES')}`);
      console.log(`${'='.repeat(60)}\n`);

      const resultados = [];
      let actualizados = 0;
      let errores = 0;

      for (let i = 0; i < productos.length; i++) {
        const producto = productos[i];
        console.log(`[${i + 1}/${productos.length}] Procesando...`);
        
        try {
          const resultado = await this.actualizarPrecioProducto(producto);
          resultados.push({
            producto_id: producto.id,
            nombre: producto.nombre,
            ...resultado
          });

          if (resultado.actualizado) {
            actualizados++;
          }

          // Delay entre peticiones para evitar bloqueos
          if (i < productos.length - 1) {
            await this.delay(3000);
          }
        } catch (error) {
          errores++;
          console.error(`❌ Error en producto ${producto.id}: ${error.message}`);
          resultados.push({
            producto_id: producto.id,
            nombre: producto.nombre,
            actualizado: false,
            error: error.message
          });
        }
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ Actualización completa`);
      console.log(`   📊 Total: ${productos.length}`);
      console.log(`   ✓ Actualizados: ${actualizados}`);
      console.log(`   ℹ️ Sin cambios: ${productos.length - actualizados - errores}`);
      console.log(`   ❌ Errores: ${errores}`);
      console.log(`${'='.repeat(60)}\n`);

      return {
        total: productos.length,
        actualizados: actualizados,
        sinCambios: productos.length - actualizados - errores,
        errores: errores,
        resultados: resultados
      };

    } catch (error) {
      console.error('❌ Error en actualización masiva:', error.message);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new ScraperService();