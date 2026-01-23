const axios = require('axios');
const cheerio = require('cheerio');

class BaseScraper {
  constructor() {
    this.userAgent = process.env.USER_AGENT || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    this.timeout = 15000; // Aumentado a 15 segundos
  }

  async fetchPage(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Referer': 'https://www.pccomponentes.com/',
          'DNT': '1',
        },
        timeout: this.timeout,
        maxRedirects: 5
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        console.error(`❌ Error ${error.response.status}: ${error.response.statusText}`);
        if (error.response.status === 403) {
          console.error('⚠️ PCComponentes bloqueó la petición');
          console.error('💡 Intenta:');
          console.error('   1. Esperar unos minutos');
          console.error('   2. Probar con otra URL');
          console.error('   3. Verificar tu User-Agent');
        }
      }
      throw new Error(`No se pudo acceder a la página: ${error.message}`);
    }
  }

  parseHTML(html) {
    return cheerio.load(html);
  }

  cleanPrice(priceText) {
    if (!priceText) return null;
    const cleaned = priceText
      .replace(/[€$£\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  }

  isAvailable(text) {
    if (!text) return false;
    const unavailableKeywords = [
      'agotado', 'sin stock', 'no disponible', 
      'out of stock', 'unavailable'
    ];
    const lowerText = text.toLowerCase();
    return !unavailableKeywords.some(keyword => lowerText.includes(keyword));
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Nueva función: delay aleatorio
  async randomDelay(min = 2000, max = 5000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`⏳ Esperando ${delay}ms para no ser detectado como bot...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = BaseScraper;