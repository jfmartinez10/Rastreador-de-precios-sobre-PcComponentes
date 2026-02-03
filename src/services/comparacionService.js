import puppeteer from 'puppeteer';
import Producto from '../models/producto.js';
import HistorialPrecios from '../models/historialPrecios.js';

class ComparacionService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    this.timeout = 30000;
  }

  // FUNCIÓN PRINCIPAL: Comparar con fuentes externas
  async compararConFuentesExternas(productoId) {
    try {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🔍 INICIANDO COMPARACIÓN CON FUENTES EXTERNAS`);
      console.log(`${'='.repeat(70)}\n`);

      // 1. Obtener datos internos del producto
      const producto = await Producto.obtenerPorId(productoId);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      const estadisticas = await Producto.obtenerEstadisticas(productoId);
      
      console.log(`📦 Producto: ${producto.nombre.substring(0, 60)}...`);
      console.log(`💰 Precio Interno Actual: ${estadisticas.precio_actual}€\n`);

      // 2. Obtener datos de fuentes externas
      const datosExternos = await this.obtenerDatosExternos(
        producto.nombre,
        producto.url
      );

      console.log(`\n${'='.repeat(70)}`);
      console.log(`✅ COMPARACIÓN COMPLETADA`);
      console.log(`${'='.repeat(70)}\n`);

      return {
        producto: {
          id: producto.id,
          nombre: producto.nombre,
          url: producto.url,
          imagen_url: producto.imagen_url
        },
        precioInterno: {
          actual: parseFloat(estadisticas.precio_actual || 0),
          minimo: parseFloat(estadisticas.precio_minimo || 0),
          maximo: parseFloat(estadisticas.precio_maximo || 0),
          promedio: parseFloat(estadisticas.precio_promedio || 0),
          totalRegistros: parseInt(estadisticas.total_registros || 0)
        },
        fuentesExternas: datosExternos.fuentes,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error en comparación:', error);
      throw error;
    }
  }

  // OBTENER DATOS DE FUENTES EXTERNAS - ACTUALIZADO: Ahora incluye CamelCamelCamel en lugar de metadatos de PCComponentes
  async obtenerDatosExternos(nombreProducto, urlPCComponentes) {
    console.log('🌐 Buscando en fuentes externas...\n');

    const fuentes = [];
    
    // Búsqueda en paralelo: Google Shopping y CamelCamelCamel
    const [googleShoppingData, camelData] = await Promise.allSettled([
      this.buscarEnGoogleShopping(nombreProducto),
      this.buscarEnCamelCamelCamel(nombreProducto)
    ]);

    // Procesar resultado de Google Shopping
    if (googleShoppingData.status === 'fulfilled' && googleShoppingData.value) {
      fuentes.push({
        nombre: 'Google Shopping',
        icono: '🛍️',
        precio: googleShoppingData.value.precio,
        url: googleShoppingData.value.url,
        disponible: true,
        timestamp: new Date().toISOString()
      });
      console.log(`✅ Google Shopping: ${googleShoppingData.value.precio}€`);
    } else {
      fuentes.push({
        nombre: 'Google Shopping',
        icono: '🛍️',
        precio: null,
        url: null,
        disponible: false,
        error: googleShoppingData.reason?.message || 'No se encontró precio'
      });
      console.log(`❌ Google Shopping: No se pudo obtener precio`);
    }

    // Procesar resultado de CamelCamelCamel
    if (camelData.status === 'fulfilled' && camelData.value) {
      const esProdRelacionado = !camelData.value.esExacto;
      
      fuentes.push({
        nombre: 'CamelCamelCamel (Amazon)',
        icono: '🐫',
        precio: camelData.value.precio,
        url: camelData.value.url,
        asin: camelData.value.asin,
        titulo: camelData.value.titulo,
        esExacto: camelData.value.esExacto,
        porcentajeCoincidencia: camelData.value.porcentajeCoincidencia,
        mensaje: esProdRelacionado ? '⚠️ Producto relacionado - El modelo exacto no está disponible en Amazon' : null,
        disponible: true,
        timestamp: new Date().toISOString()
      });
      
      if (esProdRelacionado) {
        console.log(`⚠️ CamelCamelCamel: Producto relacionado - ${camelData.value.precio}€`);
      } else {
        console.log(`✅ CamelCamelCamel: ${camelData.value.precio}€`);
      }
    } else {
      fuentes.push({
        nombre: 'CamelCamelCamel (Amazon)',
        icono: '🐫',
        precio: null,
        url: null,
        disponible: false,
        error: camelData.reason?.message || 'No se encontró precio'
      });
      console.log(`❌ CamelCamelCamel: No se pudo obtener precio`);
    }

    const fuentesConPrecio = fuentes.filter(f => f.precio !== null && f.precio !== undefined);
    console.log(`\n📊 Se obtuvieron datos de ${fuentes.length} fuente(s)`);
    console.log(`💰 Fuentes con precio: ${fuentesConPrecio.length}\n`);

    return { fuentes, fuentesConPrecio: fuentesConPrecio.length };
  }

  // BUSCAR EN GOOGLE SHOPPING
  async buscarEnGoogleShopping(nombreProducto) {
    let browser;
    try {
      console.log('🛍️ Consultando Google Shopping...');

      const terminoBusqueda = this.limpiarNombreProducto(nombreProducto);
      const urlBusqueda = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(terminoBusqueda)}`;

      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      await page.goto(urlBusqueda, { 
        waitUntil: 'domcontentloaded',
        timeout: this.timeout 
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const resultado = await page.evaluate(() => {
        const precioSelectors = [
          '[data-sh-pr]',
          '.a8Pemb',
          '.HRLxBb',
          'span[aria-label*="€"]',
          'span[aria-label*="EUR"]'
        ];

        let precio = null;
        let url = null;

        for (const selectores of [precioSelectors, ['span', 'div']]) {
          for (const selector of selectores) {
            const elementos = document.querySelectorAll(selector);
            
            for (const elemento of elementos) {
              const precioTexto = elemento.innerText || elemento.textContent || elemento.getAttribute('aria-label') || '';
              const precioMatch = precioTexto.match(/(\d+[.,]\d{2})/);
              
              if (precioMatch) {
                const precioNumero = parseFloat(precioMatch[1].replace(',', '.'));
                
                if (precioNumero > 0 && precioNumero < 100000) {
                  precio = precioNumero;
                  
                  const enlace = elemento.closest('a');
                  if (enlace) {
                    url = enlace.href;
                  }
                  
                  break;
                }
              }
            }
            
            if (precio) break;
          }

          if (!precio) {
            const bodyText = document.body.innerText;
            const preciosEncontrados = bodyText.match(/(\d+,\d{2})\s*€/g);
            
            if (preciosEncontrados && preciosEncontrados.length > 0) {
              const precioTexto = preciosEncontrados[0];
              const precioMatch = precioTexto.match(/(\d+,\d{2})/);
              if (precioMatch) {
                precio = parseFloat(precioMatch[1].replace(',', '.'));
              }
            }
          }
        }

        return { precio, url: url || window.location.href };
      });

      if (resultado.precio) {
        return resultado;
      }

      return null;

    } catch (error) {
      console.error('   Error en Google Shopping:', error.message);
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // BUSCAR EN CAMELCAMELCAMEL (vía Amazon) - MEJORADO para detectar productos exactos y relacionados
  async buscarEnCamelCamelCamel(nombreProducto) {
    let browser;
    try {
      console.log('🐫 Consultando CamelCamelCamel (Amazon)...');

      // Extraer el modelo del producto (primeras palabras clave importantes)
      const modeloProducto = this.extraerModeloProducto(nombreProducto);
      console.log(`   📝 Modelo extraído: "${modeloProducto}"`);

      const terminoBusqueda = this.limpiarNombreProducto(nombreProducto);
      const urlBusqueda = `https://www.amazon.es/s?k=${encodeURIComponent(terminoBusqueda)}`;

      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      await page.goto(urlBusqueda, { 
        waitUntil: 'domcontentloaded',
        timeout: this.timeout 
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Buscar productos con análisis de coincidencia
      const resultado = await page.evaluate((modeloBuscado) => {
        const productos = [];
        
        // Obtener todos los productos de la página
        const productCards = document.querySelectorAll('[data-asin]:not([data-asin=""])');
        
        for (const card of productCards) {
          const asin = card.getAttribute('data-asin');
          if (!asin || asin.length === 0) continue;
          
          // Obtener título del producto
          const titleElement = card.querySelector('h2 a span, h2 span, .a-text-normal');
          const titulo = titleElement ? titleElement.innerText.trim() : '';
          
          if (!titulo) continue;
          
          // Obtener precio
          const precioSelectors = [
            '.a-price-whole',
            '.a-price .a-offscreen',
            'span.a-price',
            '.a-color-price'
          ];
          
          let precio = null;
          for (const selector of precioSelectors) {
            const elem = card.querySelector(selector);
            if (elem) {
              let precioTexto = elem.innerText || elem.textContent || '';
              
              if (elem.classList.contains('a-offscreen')) {
                precioTexto = precioTexto.trim();
              }
              
              const precioMatch = precioTexto.match(/(\d{1,5})[.,](\d{2})/);
              
              if (precioMatch) {
                const precioNum = parseFloat(precioMatch[1] + '.' + precioMatch[2]);
                
                if (precioNum > 0 && precioNum < 100000) {
                  precio = precioNum;
                  break;
                }
              }
            }
          }
          
          if (!precio) continue;
          
          // Calcular puntuación de coincidencia
          const tituloLower = titulo.toLowerCase();
          const modeloLower = modeloBuscado.toLowerCase();
          
          // Dividir el modelo en palabras clave
          const palabrasModelo = modeloLower.split(/\s+/).filter(p => p.length > 2);
          
          let coincidencias = 0;
          let palabrasClave = 0;
          
          for (const palabra of palabrasModelo) {
            palabrasClave++;
            if (tituloLower.includes(palabra)) {
              coincidencias++;
            }
          }
          
          // Calcular porcentaje de coincidencia
          const porcentajeCoincidencia = palabrasClave > 0 ? (coincidencias / palabrasClave) * 100 : 0;
          
          productos.push({
            asin,
            titulo,
            precio,
            url: `https://www.amazon.es/dp/${asin}`,
            porcentajeCoincidencia
          });
        }
        
        // Ordenar por porcentaje de coincidencia
        productos.sort((a, b) => b.porcentajeCoincidencia - a.porcentajeCoincidencia);
        
        return productos;
        
      }, modeloProducto);

      if (resultado.length === 0) {
        console.log('   ❌ No se encontraron productos en Amazon');
        return null;
      }

      // Analizar resultados
      const mejorCoincidencia = resultado[0];
      const esProductoExacto = mejorCoincidencia.porcentajeCoincidencia >= 70; // 70% o más = exacto
      
      if (esProductoExacto) {
        console.log(`   ✅ Producto EXACTO encontrado: ${mejorCoincidencia.titulo.substring(0, 60)}...`);
        console.log(`   💯 Coincidencia: ${mejorCoincidencia.porcentajeCoincidencia.toFixed(0)}%`);
        console.log(`   💰 Precio: ${mejorCoincidencia.precio}€`);
        
        return {
          precio: mejorCoincidencia.precio,
          url: mejorCoincidencia.url,
          asin: mejorCoincidencia.asin,
          esExacto: true,
          titulo: mejorCoincidencia.titulo,
          porcentajeCoincidencia: mejorCoincidencia.porcentajeCoincidencia
        };
      } else {
        // Producto relacionado (no exacto)
        console.log(`   ⚠️ No se encontró producto exacto (coincidencia: ${mejorCoincidencia.porcentajeCoincidencia.toFixed(0)}%)`);
        console.log(`   🔗 Producto relacionado: ${mejorCoincidencia.titulo.substring(0, 60)}...`);
        console.log(`   💰 Precio del relacionado: ${mejorCoincidencia.precio}€`);
        
        return {
          precio: mejorCoincidencia.precio,
          url: mejorCoincidencia.url,
          asin: mejorCoincidencia.asin,
          esExacto: false,
          titulo: mejorCoincidencia.titulo,
          porcentajeCoincidencia: mejorCoincidencia.porcentajeCoincidencia,
          mensaje: 'Producto relacionado (el modelo exacto no está disponible en Amazon)'
        };
      }

    } catch (error) {
      console.error('   Error en CamelCamelCamel/Amazon:', error.message);
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // NUEVA FUNCIÓN: Extraer el modelo del producto (primeras palabras importantes)
  extraerModeloProducto(nombreCompleto) {
    // Limpiar el nombre
    let nombre = nombreCompleto
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Dividir en palabras
    const palabras = nombre.split(' ');
    
    // Tomar las primeras 4-6 palabras significativas (marca + modelo)
    // Ignorar palabras muy comunes que no identifican el producto
    const palabrasIgnorar = ['con', 'de', 'para', 'en', 'la', 'el', 'los', 'las', 'un', 'una'];
    
    const palabrasSignificativas = palabras.filter(p => 
      p.length > 2 && !palabrasIgnorar.includes(p.toLowerCase())
    );
    
    // Tomar máximo las primeras 5 palabras significativas
    const modelo = palabrasSignificativas.slice(0, 5).join(' ');
    
    return modelo;
  }

  // LIMPIAR NOMBRE DEL PRODUCTO PARA BÚSQUEDA
  limpiarNombreProducto(nombre) {
    return nombre
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  // DELAY HELPER
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new ComparacionService();