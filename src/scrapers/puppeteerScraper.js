require('dotenv').config();
const puppeteer = require('puppeteer');

class PuppeteerScraper {
  constructor() {
    this.shopName = 'PCComponentes';
    // Utilizamos userAgent para hacernos pasar por un usuario real de Windows
    this.userAgent = process.env.USER_AGENT || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  }

  async scrape(url) {
    let browser;
    try {
      console.log('🚀 Abriendo navegador...');
      
      browser = await puppeteer.launch({
        headless: 'new', // Ejecuta el navegador sin ventana
        args: [
          '--no-sandbox', // Desactiva el modo aislamiento
          '--disable-setuid-sandbox', // Evita problemas de permisos en entornos Linux al ejecutar el navegador como root
          '--disable-blink-features=AutomationControlled', // Evita que las webs detecten fácilmente que el navegador está siendo controlado por un robot
          `--window-size=1920,1080` // Forzamos el tamaño de la ventana interna del navegador.
        ]
      });

      const page = await browser.newPage();

      // Configurar User-Agent y Viewport juntos
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ 
        width: 1920, 
        height: 1080,
        deviceScaleFactor: 1
      });

      console.log(`🔍 Navegando a: ${url}`);
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Esperar a que aparezca el título
      await page.waitForSelector('#pdp-title', { timeout: 10000 });

      console.log('📦 Extrayendo datos...');

      const datos = await page.evaluate(() => {
        // Nombre
        const nombre = document.querySelector('#pdp-title')?.innerText || null;

        // Precio
        const precioEntero = document.querySelector('#pdp-price-current-integer')?.innerText || '0';
        const precioDecimal = document.querySelector('[id*="decimal"]')?.innerText || '00';
        const precioCompleto = `${precioEntero}.${precioDecimal}`;
        const precio = parseFloat(precioCompleto);

        // Disponibilidad
        const botonAñadir = document.querySelector('button[id*="add-to-cart"]');
        const disponible = botonAñadir !== null;

        // Imagen (búsqueda inteligente y genérica)
        const imagenElement = Array.from(document.querySelectorAll('img')).find(img => {
          // 1. Debe tener src válido
          // 2. Debe ser lo suficientemente grande (ancho > 200px)
          // 3. NO debe ser el logo de la tienda
          // 4. NO debe ser un icono pequeño
          // 5. Preferiblemente que esté en el contenedor del producto
          
          if (!img.src || img.src === '') return false; // Debe tener src válido
          if (img.width < 200 || img.height < 200) return false; // Debe ser lo suficientemente grande (ancho > 200px)
          if (img.src.includes('logo')) return false; // NO debe ser el logo de la tienda
          if (img.src.includes('icon')) return false; // NO debe ser un icono pequeño
          if (img.alt && img.alt.toLowerCase().includes('logo')) return false; // Preferiblemente que esté en el contenedor del producto
          
          return true;
        });

        const imagen = imagenElement?.src || null;

        return {
          nombre,
          precio: isNaN(precio) ? null : precio,
          disponible,
          imagen
        };
      });

      console.log('✅ Datos extraídos correctamente');

      return {
        ...datos,
        moneda: 'EUR',
        tienda: this.shopName,
        estado_stock: datos.disponible ? 'Disponible' : 'Agotado'
      };

    } catch (error) {
      console.error('❌ Error en scraping:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = PuppeteerScraper;