import BaseScraper from './baseScraper.js';
import * as cheerio from 'cheerio';

// Clase que hereda de BaseScraper
class PCComponentesScraper extends BaseScraper {
  constructor() {
    super(); // Llama al constructor de la clase padre
    this.shopName = 'PCComponentes';
    this.baseUrl = 'https://www.pccomponentes.com';
  }

  // Scrapear un producto
  async scrape(url) {
    try {
      if (!this.isValidUrl(url) || !url.includes('pccomponentes')) {
        throw new Error('URL inválida o no es de PCComponentes');
      }

      console.log(`🔍 Scrapeando: ${url}`);

      // Espera un poco antes de hacer la petición
      await this.randomDelay(2000, 4000);

      const html = await this.fetchPage(url);
      // Carga el HTML en Cheerio
      const $ = cheerio.load(html);

      // Extrae cada dato usando los selectores indicados
      const nombre = this.extractName($);
      const precio = this.extractPrice($);
      const disponible = this.extractAvailability($);
      const imagen_url = this.extractImage($);

      // Valida el nombre del producto
      if (!nombre) {
        throw new Error('No se pudo extraer el nombre del producto');
      }

      // Devuelve objeto con todos los datos limpios
      return {
        nombre,
        precio,
        moneda: 'EUR',
        disponible,
        imagen_url,
        tienda: this.shopName,
        estado_stock: disponible ? 'Disponible' : 'Agotado'
      };

    } catch (error) {
      console.error('❌ Error en PCComponentes scraper:', error.message);
      throw error;
    }
  }

  // Extrae el nombre del producto
  extractName($) {
    const selectors = [
      '#pdp-title',
      'h1[id="pdp-title"]',
      'h1.heading-module_heading',
      'h1'
    ];

    // Prueba cada selector hasta encontrar uno que funcione
    for (const selector of selectors) {
      const name = $(selector).first().text().trim();
      if (name) {
        console.log(`✅ Nombre encontrado: ${name.substring(0, 50)}...`);
        return name;
      }
    }

    console.log('❌ No se encontró el nombre');
    return null;
  }

  // Extrae el precio
  extractPrice($) {
    const selectors = [
      '#pdp-price-current-integer',
      '.integer-KBIK6g',
      '[id*="price"]',
      '.precio-actual'
    ];

    for (const selector of selectors) {
      const priceElement = $(selector).first();
      let priceText = priceElement.text().trim();
      
      // Intenta obtener decimales de los precios si existen
      const decimalsElement = priceElement.siblings('[id*="decimal"]');
      if (decimalsElement.length) {
        const decimals = decimalsElement.text().trim();
        priceText += ',' + decimals;
      }

      // Limpia y convierte a número el precio
      const price = this.cleanPrice(priceText);
      
      if (price !== null) {
        console.log(`✅ Precio encontrado: ${price}€`);
        return price;
      }
    }

    console.log('❌ No se encontró el precio');
    return null;
  }

  // Extrae la disponibilidad
  extractAvailability($) {
    // Busca el botón "Añadir al carrito"
    const addToCartButton = $('button:contains("Añadir")').length > 0;
    
    if (addToCartButton) {
      console.log('✅ Disponible (botón encontrado)');
      return true;
    }

    // Busca texto de envío
    const shippingText = $('body').text();
    if (shippingText.includes('Recíbelo') || shippingText.includes('Envío')) {
      console.log('✅ Disponible (info de envío encontrada)');
      return true;
    }

    // Busca la palabra "agotado"
    if (shippingText.toLowerCase().includes('agotado')) {
      console.log('❌ No disponible (agotado)');
      return false;
    }

    // Por defecto, asume que es disponible si hay precio
    console.log('⚠️ Disponibilidad no clara, asumiendo disponible');
    return true;
  }

  // Extrae la imagen
  extractImage($) {
    const selectors = [
      '.swiperImage-wXIAm4',
      'img[class*="swiperImage"]',
      '[data-testid="product-image"]',
      '.product-image img',
      'img[alt*="Portátil"]',
      'img[alt*="HP"]'
    ];

    for (const selector of selectors) {
      const img = $(selector).first();
      let imageUrl = img.attr('src') || img.attr('data-src');
      
      // Si es URL relativa, lo convierte a absoluta
      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = this.baseUrl + imageUrl;
      }
      
      if (imageUrl && !imageUrl.includes('placeholder')) {
        console.log(`✅ Imagen encontrada: ${imageUrl.substring(0, 50)}...`);
        return imageUrl;
      }
    }

    console.log('❌ No se encontró imagen');
    return null;
  }

  // Valida si una URL es de PCComponentes
  static isValidShopUrl(url) {
    return url.includes('pccomponentes.com');
  }
}

export default PCComponentesScraper;