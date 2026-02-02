import puppeteer from 'puppeteer';

class PuppeteerScraper {
  constructor() {
    this.shopName = 'PCComponentes';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  }

  async scrape(url) {
    let browser;
    try {
      console.log('🚀 Abriendo navegador Puppeteer...');
      
      browser = await puppeteer.launch({
        headless: 'new',
        ignoreHTTPSErrors: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--ignore-certificate-errors'
        ]
      });

      const page = await browser.newPage();

      // Configurar como navegador real
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Ocultar que somos un bot
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es'] });
      });

      console.log(`🔍 Navegando a: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Esperar que cargue el contenido
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('📦 Extrayendo datos...');

      const datos = await page.evaluate(() => {
        // Nombre del producto
        let nombre = null;
        
        const nombreSelectors = [
          'h1[data-cy="product-title"]',
          'h1.h3',
          '#pdp-title',
          'h1[itemprop="name"]',
          'h1.product-name',
          'h1'
        ];
        
        for (const selector of nombreSelectors) {
          try {
            const elem = document.querySelector(selector);
            if (elem && elem.innerText && elem.innerText.trim().length > 5) {
              nombre = elem.innerText.trim();
              break;
            }
          } catch (e) {}
        }

        // Precio del producto
        let precio = null;
        
        const precioSelectors = [
          '[data-cy="product-price"]',
          '.precio-main',
          '#precio-main',
          '[id*="precio"]',
          '.price-tag',
          '[class*="price"]',
        ];

        for (const selector of precioSelectors) {
          try {
            const elem = document.querySelector(selector);
            if (elem) {
              let precioText = elem.innerText || elem.textContent || '';
              
              precioText = precioText
                .replace(/\s/g, '')
                .replace(/€/g, '')
                .replace(/\./g, '')
                .replace(',', '.');
              
              const precioNum = parseFloat(precioText);
              
              if (!isNaN(precioNum) && precioNum > 0 && precioNum < 100000) {
                precio = precioNum;
                break;
              }
            }
          } catch (e) {}
        }

        // Fallback: buscar en el texto completo
        if (!precio) {
          const bodyText = document.body.innerText;
          const precioMatch = bodyText.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);
          if (precioMatch) {
            const precioText = precioMatch[1].replace(/\./g, '').replace(',', '.');
            const precioNum = parseFloat(precioText);
            if (!isNaN(precioNum) && precioNum > 0) {
              precio = precioNum;
            }
          }
        }

        // Porcentaje de descuento
        let porcentaje_descuento = null;
        
        const html = document.body.innerHTML;
        const regex = /-\s*(\d{1,2})\s*%/g;
        const matches = [];
        let match;
        
        // Buscar TODOS los matches de "-XX%"
        while ((match = regex.exec(html)) !== null) {
          const percentage = parseInt(match[1]);
          
          // Validar rango
          if (percentage >= 5 && percentage <= 99) {
            // Obtener contexto (50 caracteres antes y después)
            const startIndex = Math.max(0, match.index - 50);
            const endIndex = Math.min(html.length, match.index + 50);
            const contexto = html.substring(startIndex, endIndex).toLowerCase();
            
            // FILTRO: Ignorar si está cerca de palabras de valoración
            const palabrasExcluir = [
              'recomiendan',
              'recomienda',
              'valoración',
              'valoracion',
              'rating',
              'review',
              'opinion',
              'opinión'
            ];
            
            const esValoracion = palabrasExcluir.some(palabra => contexto.includes(palabra));
            
            if (!esValoracion) {
              matches.push(percentage);
            }
          }
        }
        
        // Tomar el PRIMERO (que debería ser el badge de descuento)
        if (matches.length > 0) {
          porcentaje_descuento = matches[0];
          console.log(`✅ Descuento detectado: ${porcentaje_descuento}%`);
        } else {
          console.log('ℹ️ No se encontró descuento (sin "-XX%" en la página)');
        }

        // Disponibilidad
        let disponible = true; // Por defecto sí disponible
        
        const bodyText = document.body.innerText.toLowerCase();
        const unavailableKeywords = [
          'agotado',
          'sin stock',
          'no disponible',
          'out of stock',
          'próximamente'
        ];
        
        for (const keyword of unavailableKeywords) {
          if (bodyText.includes(keyword)) {
            disponible = false;
            break;
          }
        }

        const addToCartSelectors = [
          'button[data-cy="add-to-cart"]',
          'button[id*="add-to-cart"]',
          'button[id*="añadir"]',
          'button.buy-button',
          '.add-to-cart'
        ];

        let hasAddButton = false;
        for (const selector of addToCartSelectors) {
          if (document.querySelector(selector)) {
            hasAddButton = true;
            break;
          }
        }

        if (!hasAddButton && disponible) {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const text = (btn.innerText || '').toLowerCase();
            if (text.includes('comprar') || text.includes('añadir')) {
              hasAddButton = true;
              break;
            }
          }
        }

        // Imagen del producto
        let imagen_url = null;
        
        const imagenSelectors = [
          'img[data-cy="product-image"]',
          'img.product-image',
          'img[itemprop="image"]',
          '#image-product',
          'img[alt*="producto"]',
          'img[alt*="Product"]'
        ];

        for (const selector of imagenSelectors) {
          try {
            const img = document.querySelector(selector);
            if (img && img.src) {
              const src = img.src;
              if (!src.includes('placeholder') && 
                  !src.includes('1x1') && 
                  !src.includes('logo') &&
                  !src.includes('icon')) {
                imagen_url = src;
                break;
              }
            }
          } catch (e) {}
        }

        // Buscar cualquier imagen grande
        if (!imagen_url) {
          const allImages = document.querySelectorAll('img');
          for (const img of allImages) {
            if (img.src && 
                (img.naturalWidth > 200 || img.width > 200) &&
                !img.src.includes('logo') && 
                !img.src.includes('icon') &&
                !img.src.includes('1x1')) {
              imagen_url = img.src;
              break;
            }
          }
        }

        return {
          nombre,
          precio,
          porcentaje_descuento,
          disponible,
          imagen_url
        };
      });

      if (!datos.nombre || datos.precio === null) {
        console.error('❌ Datos extraídos incompletos:', datos);
        throw new Error('No se pudo extraer información del producto');
      }

      console.log('✅ Datos extraídos correctamente');
      console.log(`   📦 Producto: ${datos.nombre.substring(0, 60)}...`);
      console.log(`   💰 Precio: ${datos.precio}€`);
      console.log(`   🏷️  Descuento: ${datos.porcentaje_descuento ? datos.porcentaje_descuento + '%' : 'Sin descuento'}`);
      console.log(`   ✔ Disponible: ${datos.disponible ? 'Sí' : 'No'}`);

      return {
        ...datos,
        moneda: 'EUR',
        tienda: this.shopName,
        estado_stock: datos.disponible ? 'Disponible' : 'Agotado'
      };

    } catch (error) {
      console.error('❌ Error en Puppeteer scraper:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

export default PuppeteerScraper;