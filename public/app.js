// Variables globales
let currentPage = {
    chollos: 1,
    todos: 1
};

const ITEMS_PER_PAGE = 12;
const ITEMS_CHOLLOS_PAGE = 8;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicación...');
    
    const urlInput = document.getElementById('urlInput');
    const addBtn = document.getElementById('addBtn');
    
    if (urlInput && addBtn) {
        addBtn.addEventListener('click', añadirProducto);
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') añadirProducto();
        });
    }
    
    // Cargar contenido según la página actual
    const path = window.location.pathname;
    
    if (path === '/' || path.includes('index.html')) {
        cargarChollosDestacados();
        cargarProductosRecientes();
    } else if (path.includes('chollos.html')) {
        cargarChollosPaginados(1);
    } else if (path.includes('productos.html')) {
        cargarProductosPaginados(1);
    }
});

// Añadir producto
async function añadirProducto() {
    const urlInput = document.getElementById('urlInput');
    const addBtn = document.getElementById('addBtn');
    const url = urlInput.value.trim();
    
    if (!url) {
        mostrarToast('Por favor, ingresa una URL válida', 'warning');
        return;
    }
    
    if (!url.includes('pccomponentes.com')) {
        mostrarToast('La URL debe ser de PCComponentes', 'error');
        return;
    }
    
    addBtn.disabled = true;
    addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Rastreando...</span>';
    
    try {
        const res = await fetch('/api/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await res.json();
        
        if (data.exito) {
            mostrarToast(
                data.yaExistia ? 'Este producto ya está en seguimiento' : '✅ Producto añadido correctamente',
                data.yaExistia ? 'info' : 'success'
            );
            urlInput.value = '';
            
            // Redirigir al producto después de un breve delay
            setTimeout(() => {
                const productoId = data.datos?.producto?.id || data.datos?.id;
                if (productoId) {
                    window.location.href = `/producto.html?id=${productoId}`;
                } else {
                    // Fallback: recargar si no hay ID
                    location.reload();
                }
            }, 800);
        } else {
            mostrarToast(data.error || 'Error al añadir producto', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error de conexión', 'error');
    } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fas fa-plus"></i> <span>Rastrear</span>';
    }
}

// Cargar chollos destacados (index)
async function cargarChollosDestacados() {
    const grid = document.getElementById('chollosGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> <span>Cargando ofertas...</span></div>';
    
    try {
        const res = await fetch('/api/analytics/mejores-ofertas?limite=4');
        const data = await res.json();
        
        if (data.exito && data.datos.length > 0) {
            grid.innerHTML = data.datos.map(producto => crearTarjetaProducto(producto)).join('');
        } else {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No hay ofertas disponibles</p></div>';
        }
    } catch (error) {
        console.error('Error cargando chollos:', error);
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error cargando ofertas</p></div>';
    }
}

// Cargar productos recientes (index)
async function cargarProductosRecientes() {
    const grid = document.getElementById('todosGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> <span>Cargando productos...</span></div>';
    
    try {
        const res = await fetch('/api/productos?limite=4&offset=0');
        const data = await res.json();
        
        if (data.exito && data.datos.length > 0) {
            grid.innerHTML = data.datos.map(producto => crearTarjetaProducto(producto)).join('');
        } else {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No hay productos rastreados</p></div>';
        }
    } catch (error) {
        console.error('Error cargando productos:', error);
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error cargando productos</p></div>';
    }
}

// Cargar chollos paginados (chollos.html)
async function cargarChollosPaginados(page) {
    const grid = document.getElementById('chollosGrid');
    const paginationContainer = document.getElementById('pagination');
    
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> <span>Cargando ofertas...</span></div>';
    
    try {
        const offset = (page - 1) * ITEMS_CHOLLOS_PAGE;
        const res = await fetch(`/api/analytics/mejores-ofertas?limite=${ITEMS_CHOLLOS_PAGE}&offset=${offset}`);
        const data = await res.json();
        
        if (data.exito && data.datos.length > 0) {
            grid.innerHTML = data.datos.map(producto => crearTarjetaProducto(producto)).join('');
            
            if (paginationContainer && data.total > ITEMS_CHOLLOS_PAGE) {
                const totalPages = Math.ceil(data.total / ITEMS_CHOLLOS_PAGE);
                paginationContainer.innerHTML = crearPaginacion(page, totalPages, 'chollos');
            } else if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
        } else {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No hay ofertas disponibles</p></div>';
            if (paginationContainer) paginationContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Error cargando chollos:', error);
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error cargando ofertas</p></div>';
    }
}

// Cargar productos paginados (productos.html)
async function cargarProductosPaginados(page) {
    const grid = document.getElementById('todosGrid');
    const paginationContainer = document.getElementById('pagination');
    
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> <span>Cargando productos...</span></div>';
    
    try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const res = await fetch(`/api/productos?limite=${ITEMS_PER_PAGE}&offset=${offset}`);
        const data = await res.json();
        
        if (data.exito && data.datos.length > 0) {
            grid.innerHTML = data.datos.map(producto => crearTarjetaProducto(producto)).join('');
            
            if (paginationContainer && data.total > ITEMS_PER_PAGE) {
                const totalPages = Math.ceil(data.total / ITEMS_PER_PAGE);
                paginationContainer.innerHTML = crearPaginacion(page, totalPages, 'productos');
            } else if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
        } else {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No hay productos rastreados</p></div>';
            if (paginationContainer) paginationContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Error cargando productos:', error);
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error cargando productos</p></div>';
    }
}

// Crear tarjeta de producto
function crearTarjetaProducto(producto) {
    const disponible = producto.disponible !== false;
    const descuento = producto.porcentaje_descuento ? parseInt(producto.porcentaje_descuento) : 0;
    const precioActual = producto.precio_actual ? parseFloat(producto.precio_actual) : null;
    
    // Calcular precio anterior SI HAY descuento
    let precioAnterior = null;
    if (descuento >= 5 && precioActual) {
        precioAnterior = precioActual / (1 - descuento / 100);
    }
    
    const cardClasses = ['product-card'];
    if (!disponible) {
        cardClasses.push('unavailable');
    }
    
    const imagenFiltro = disponible ? '' : ' style="filter: grayscale(70%) brightness(0.8);"';
    
    // Badge de descuento
    const badgeDescuento = descuento >= 5 ? `
        <div class="discount-badge">-${descuento}%</div>
    ` : '';
    
    // Badge de agotado
    const badgeDisponibilidad = !disponible ? `
        <span class="availability-badge unavailable">
            <i class="fas fa-exclamation-circle"></i>
            AGOTADO
        </span>
    ` : '';
    
    // Precio con o sin tachado
    let precioHTML;
    if (precioAnterior && descuento >= 5) {
        precioHTML = `
            <div>
                <div class="precio-tachado">
                    ${precioAnterior.toFixed(2)}€
                </div>
                <span class="product-price">${precioActual.toFixed(2)}€</span>
                ${badgeDisponibilidad}
            </div>
        `;
    } else if (precioActual) {
        precioHTML = `
            <div>
                <span class="product-price">${precioActual.toFixed(2)}€</span>
                ${badgeDisponibilidad}
            </div>
        `;
    } else {
        precioHTML = `
            <div>
                <span class="product-price">--</span>
                ${badgeDisponibilidad}
            </div>
        `;
    }
    
    return `
        <div class="${cardClasses.join(' ')}" onclick="window.location.href='/producto.html?id=${producto.id}'">
            <div class="product-image-container">
                ${badgeDescuento}
                <img src="${producto.imagen_url || 'https://via.placeholder.com/300?text=Sin+Imagen'}" 
                     alt="${producto.nombre}" 
                     class="product-image"${imagenFiltro}
                     loading="lazy">
            </div>
            <div class="product-body">
                <h3 class="product-title">${producto.nombre}</h3>
                <div class="product-price-container">
                    ${precioHTML}
                </div>
            </div>
        </div>
    `;
}

// Paginación
function crearPaginacion(currentPage, totalPages, tipo) {
    let html = '';
    
    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="cambiarPagina(${currentPage - 1}, '${tipo}')">
        <i class="fas fa-chevron-left"></i> Anterior
    </button>`;
    
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        const pageNum = i === 1 ? i : 
                        i === 5 ? totalPages :
                        currentPage <= 3 ? i :
                        currentPage >= totalPages - 2 ? totalPages - 5 + i :
                        currentPage - 3 + i;
        
        html += `<button class="pagination-btn ${currentPage === pageNum ? 'active' : ''}" 
                         onclick="cambiarPagina(${pageNum}, '${tipo}')">${pageNum}</button>`;
    }
    
    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="cambiarPagina(${currentPage + 1}, '${tipo}')">
        Siguiente <i class="fas fa-chevron-right"></i>
    </button>`;
    
    return html;
}

function cambiarPagina(page, tipo) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (tipo === 'chollos') {
        currentPage.chollos = page;
        cargarChollosPaginados(page);
    } else {
        currentPage.todos = page;
        cargarProductosPaginados(page);
    }
}

// Toast notifications
function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <span>${mensaje}</span>
        <i class="fas fa-times" onclick="this.parentElement.remove()"></i>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
