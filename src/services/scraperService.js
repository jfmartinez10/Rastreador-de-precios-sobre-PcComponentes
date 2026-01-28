const PuppeteerScraper = require('../scrapers/puppeteerScraper');
const Producto = require('../models/producto');
const HistorialPrecios = require('../models/historialPrecios'); 

class ScraperService {
  constructor() {
    this.scraper = new PuppeteerScraper();
  }

  async añadirProducto(url, categoria = null) {
    try {
      console.log(`🔍 Scrapeando producto de ${this.scraper.shopName}...`);

      // Crear scrapeo inicial
      const datosScrap = await this.scraper.scrape(url);

      // Crear producto en la base de datos
      const producto = await Producto.crear({
        nombre: datosScrap.nombre,
        url: url,
        tienda: datosScrap.tienda,
        categoria: categoria,
        imagen_url: datosScrap.imagen
      });

      console.log(`✅ Producto creado con ID: ${producto.id}`);

      // Registrar precio inicial si existe
      if (datosScrap.precio !== null) {
        await HistorialPrecios.crear({
          producto_id: producto.id,
          precio: datosScrap.precio,
          moneda: datosScrap.moneda,
          disponible: datosScrap.disponible,
          estado_stock: datosScrap.estado_stock
        });
        console.log(`💰 Precio inicial registrado: ${datosScrap.precio}€`);
      }

      return {
        producto,
        precioInicial: datosScrap.precio,
        disponible: datosScrap.disponible
      };

    } catch (error) {
      console.error('❌ Error añadiendo producto:', error.message);
      throw error;
    }
  }

  async actualizarPrecioProducto(producto) {
    try {
      console.log(`🔄 Actualizando precio de: ${producto.nombre}`);

      // hacer scrapeo para obtener datos actuales
      const datosScrap = await this.scraper.scrape(producto.url);
      
      // obtener el último precio registrado
      const ultimoPrecio = await HistorialPrecios.obtenerUltimo(producto.id);

      // Solo registra si cambio el precio o disponibilidad
      const precioCambio = !ultimoPrecio || ultimoPrecio.precio !== datosScrap.precio;
      const disponibilidadCambio = !ultimoPrecio || ultimoPrecio.disponible !== datosScrap.disponible;

      if (precioCambio || disponibilidadCambio) {
        await HistorialPrecios.crear({
          producto_id: producto.id,
          precio: datosScrap.precio,
          moneda: datosScrap.moneda,
          disponible: datosScrap.disponible,
          estado_stock: datosScrap.estado_stock
        });

        console.log(`✅ Precio actualizado: ${datosScrap.precio}€ (anterior: ${ultimoPrecio?.precio || 'N/A'}€)`);

        return {
          actualizado: true,
          precioAnterior: ultimoPrecio?.precio,
          precioNuevo: datosScrap.precio,
          cambioPrecio: precioCambio,
          cambioDisponibilidad: disponibilidadCambio
        };
      }

      console.log(`ℹ️ Sin cambios en el precio`);
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
      console.log(`📦 Actualizando ${productos.length} productos...`);

      const resultados = [];

      for (const producto of productos) {
        const resultado = await this.actualizarPrecioProducto(producto);
        resultados.push({
          producto_id: producto.id,
          nombre: producto.nombre,
          ...resultado
        });

        // Esperar 3 segundos entre cada solicitud para evitar bloqueos
        await this.delay(3000);
      }

      const actualizados = resultados.filter(r => r.actualizado).length;
      console.log(`✅ Actualización completa: ${actualizados}/${productos.length} productos actualizados`);

      return {
        total: productos.length,
        actualizados: actualizados,
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

module.exports = new ScraperService();