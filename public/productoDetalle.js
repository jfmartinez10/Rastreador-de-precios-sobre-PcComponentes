// Variables globales
let currentProductId = null;
let currentPeriod = 'all';

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (!id) {
        window.location.href = '/';
        return;
    }

    currentProductId = id;
    cargarDatosProducto(id);
    configurarEventListeners();
});

// Event listeners
function configurarEventListeners() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            cargarHistorial(currentProductId, currentPeriod);
        });
    });

    const updateBtn = document.getElementById('updatePriceBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', () => actualizarPrecio(currentProductId));
    }
}

// Cargar datos
async function cargarDatosProducto(id) {
    try {
        const resProducto = await fetch(`/api/productos/${id}`);
        const dataProducto = await resProducto.json();

        if (!dataProducto.exito) {
            throw new Error(dataProducto.error || 'Producto no encontrado');
        }

        const producto = dataProducto.datos;
        const agotado = producto.disponible === false;
        
        document.title = `${producto.nombre} - CamelClone PC`;
        document.getElementById('productName').textContent = producto.nombre;
        
        const imagenElement = document.getElementById('productImage');
        imagenElement.src = producto.imagen_url || 'https://via.placeholder.com/500?text=Sin+Imagen';
        
        if (agotado) {
            imagenElement.style.filter = 'grayscale(70%) brightness(0.8)';
        }
        
        const storeElement = document.getElementById('productStore');
        if (agotado) {
            storeElement.innerHTML = `
                <div style="
                    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 12px;
                    margin: 20px 0;
                    box-shadow: 0 4px 20px rgba(220, 53, 69, 0.3);
                    border: 3px solid #fff;
                ">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem;"></i>
                        <div>
                            <h3 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 800;">
                                ⚠️ PRODUCTO AGOTADO
                            </h3>
                            <p style="margin: 0; font-size: 1rem; opacity: 0.95;">
                                Este producto no está disponible actualmente en <strong>${producto.tienda}</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            storeElement.innerHTML = `<p style="color: #6c757d; margin: 10px 0;">Tienda: ${producto.tienda}</p>`;
        }
        
        document.getElementById('productLinkBtn').href = producto.url;

        await Promise.all([
            cargarEstadisticas(id, agotado),
            cargarHistorial(id, 'all')
        ]);

    } catch (error) {
        console.error('Error cargando producto:', error);
        alert('Error cargando producto: ' + error.message);
        window.location.href = '/';
    }
}

// Cargar estadísticas
async function cargarEstadisticas(id, agotado) {
    try {
        const res = await fetch(`/api/productos/${id}/estadisticas`);
        const data = await res.json();

        if (data.exito) {
            const stats = data.datos;
            const precioElement = document.getElementById('currentPrice');
            
            if (agotado) {
                precioElement.innerHTML = `
                    <span style="color: #95a5a6; text-decoration: line-through;">
                        ${stats.precio_actual ? stats.precio_actual + '€' : '--'}
                    </span>
                    <div style="
                        font-size: 1rem;
                        color: #dc3545;
                        font-weight: 600;
                        margin-top: 8px;
                    ">
                        <i class="fas fa-ban"></i> No disponible
                    </div>
                `;
            } else {
                precioElement.textContent = stats.precio_actual ? `${stats.precio_actual}€` : '--';
                precioElement.style.color = '#ff6000';
            }
            
            document.getElementById('minPrice').textContent = stats.precio_minimo ? `${parseFloat(stats.precio_minimo).toFixed(2)}€` : '--';
            document.getElementById('maxPrice').textContent = stats.precio_maximo ? `${parseFloat(stats.precio_maximo).toFixed(2)}€` : '--';
            document.getElementById('avgPrice').textContent = stats.precio_promedio ? `${parseFloat(stats.precio_promedio).toFixed(2)}€` : '--';
        }
    } catch (error) {
        console.error('Error estadísticas:', error);
    }
}

// Cargar historial
async function cargarHistorial(id, periodo) {
    try {
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

        const res = await fetch(`/api/productos/${id}/historial?periodo=${periodo}&limite=50`);
        const data = await res.json();

        if (data.exito && data.datos.length > 0) {
            tbody.innerHTML = data.datos.map(registro => {
                const fecha = new Date(registro.fecha_captura);
                const fechaFormateada = fecha.toLocaleDateString('es-ES', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const descuento = registro.porcentaje_descuento 
                    ? `<span style="color: #28a745; font-weight: 600;">-${parseInt(registro.porcentaje_descuento)}%</span>` 
                    : '-';
                
                const estado = registro.disponible 
                    ? '<span style="color: #28a745;">✓ Disponible</span>' 
                    : '<span style="color: #dc3545;">✗ Agotado</span>';
                
                return `
                    <tr>
                        <td class="history-date">${fechaFormateada}</td>
                        <td class="history-price">${parseFloat(registro.precio).toFixed(2)}€</td>
                        <td>${descuento}</td>
                        <td>${estado}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #6c757d;">No hay registros para este periodo</td></tr>';
        }
    } catch (error) {
        console.error('Error historial:', error);
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #dc3545;">Error cargando historial</td></tr>';
    }
}

// Actualizar precio
async function actualizarPrecio(id) {
    const btn = document.getElementById('updatePriceBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';

    try {
        const res = await fetch(`/api/productos/${id}/actualizar-precio`, { method: 'POST' });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.datos.actualizado ? '✅ Precio actualizado' : 'ℹ️ Sin cambios', 'success');
            await cargarDatosProducto(id);
        } else {
            mostrarToast('Error al actualizar', 'error');
        }
    } catch (error) {
        mostrarToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span>${mensaje}</span><i class="fas fa-times" onclick="this.parentElement.remove()"></i>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}
