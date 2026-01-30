import BaseScraper from './baseScraper.js';
import * as cheerio from 'cheerio';

class PCComponentesScraper extends BaseScraper {
  constructor() {
    super();
    this.shopName = 'PCComponentes';
    this.baseUrl = 'https://www.pccomponentes.com';
  }

  async scrape(url) {
    try {
      if (!this.isValidUrl(url) || !url.includes('pccomponentes')) {
        throw new Error('URL inválida o no es de PCComponentes');
      }

      console.log(`🔍 Scrapeando con Axios/Cheerio: ${url}`);
      await this.randomDelay(2000, 4000);

      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      const nombre = this.extractName($);
      const precio = this.extractPrice($);
      const disponible = this.extractAvailability($);
      const imagen_url = this.extractImage($);

      if (!nombre && !precio) {
          throw new Error('Bloqueo detectado o cambio en estructura DOM');
      }

      return {
        nombre: nombre || 'Nombre desconocido',
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

  extractName($) {
    const selectors = ['#pdp-title', 'h1.heading-module_heading', 'h1'];
    for (const selector of selectors) {
      const name = $(selector).first().text().trim();
      if (name) return name;
    }
    return null;
  }

  extractPrice($) {
    const selectors = ['#pdp-price-current-integer', '.price-current', '[data-testid="price"]'];
    for (const selector of selectors) {
      let priceText = $(selector).first().text().trim();
      const decimals = $(selector).first().siblings('[id*="decimal"]').text().trim();
      if (decimals) priceText += `,${decimals}`;
      
      const price = this.cleanPrice(priceText);
      if (price !== null) return price;
    }
    return null;
  }

  extractAvailability($) {
    const addToCart = $('button:contains("Añadir"), button:contains("Comprar")').length > 0;
    if (addToCart) return true;
    const bodyText = $('body').text().toLowerCase();
    if (bodyText.includes('agotado') || bodyText.includes('sin stock')) return false;
    return true; // Asumir disponible si no dice explícitamente agotado
  }

  extractImage($) {
    // Intentar buscar imagen principal
    const img = $('img[data-testid="product-image"], .product-image img').first();
    let src = img.attr('src') || img.attr('data-src');
    if (src && src.startsWith('/')) src = this.baseUrl + src;
    return src || null;
  }
}

export default PCComponentesScraper;
