document.addEventListener('DOMContentLoaded', () => {
    const topDropsGrid = document.getElementById('topDropsGrid');
    const productsGrid = document.getElementById('productsGrid');
    const urlInput = document.getElementById('urlInput');
    const addBtn = document.getElementById('addBtn');
    const modal = document.getElementById('historyModal');
    const closeBtn = document.querySelector('.close-btn');
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    
    let priceChart = null;
    let currentProductId = null;

    // Cargar datos iniciales
    if(topDropsGrid) loadTopDrops();
    if(productsGrid) loadAllProducts();

    // Event Listeners
    if(addBtn) addBtn.addEventListener('click', handleAddProduct);
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    if(forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', () => {
            if(currentProductId) updateProductPrice(currentProductId);
        });
    }

    // Funciones principales
    async function loadTopDrops() {
        try {
            const res = await fetch('/api/analytics/mejores-ofertas?limit=4');
            const data = await res.json();
            
            if (data.exito && data.datos.length > 0) {
                renderGrid(topDropsGrid, data.datos, true);
            } else {
                topDropsGrid.innerHTML = '<div class="empty-state">No hay ofertas destacadas todavía. ¡Añade productos!</div>';
            }
        } catch (error) {
            console.error('Error cargando chollos:', error);
            topDropsGrid.innerHTML = '<div class="error">Error cargando ofertas.</div>';
        }
    }

    async function loadAllProducts() {
        try {
            const res = await fetch('/api/productos?limit=20');
            const data = await res.json();
            
            if (data.exito && data.datos.length > 0) {
                renderGrid(productsGrid, data.datos);
            } else {
                productsGrid.innerHTML = '<div class="empty-state">No hay productos rastreados. Pega una URL arriba para empezar.</div>';
            }
        } catch (error) {
            console.error('Error cargando productos:', error);
            productsGrid.innerHTML = '<div class="error">Error cargando productos.</div>';
        }
    }

    async function handleAddProduct() {
        const url = urlInput.value.trim();
        if (!url) return showToast('Introduce una URL válida', 'error');

        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rastreando...';

        try {
            const res = await fetch('/api/productos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();

            if (data.exito) {
                showToast('✅ Producto añadido correctamente', 'success');
                urlInput.value = '';
                loadAllProducts(); // Recargar lista
                loadTopDrops();
            } else {
                showToast(`❌ Error: ${data.error}`, 'error');
            }
        } catch (error) {
            showToast('❌ Error de conexión', 'error');
        } finally {
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Rastrear';
        }
    }

    function renderGrid(container, products, isDeal = false) {
        container.innerHTML = products.map(p => `
            <div class="card">
                <div class="card-img-container">
                    <img src="${p.imagen_url || 'https://via.placeholder.com/200'}" alt="${p.nombre}" class="card-img">
                </div>
                <div class="card-body">
                    <h3 class="card-title" title="${p.nombre}">${p.nombre}</h3>
                    <div class="price-container">
                        <span class="current-price">${p.precio_actual || p.precio}€</span>
                        ${isDeal ? `<span class="discount-badge">-${p.porcentaje_descuento}%</span>` : ''}
                    </div>
                    <div class="card-actions">
                        <button onclick="openHistory('${p.id}', '${p.nombre.replace(/'/g, "\\'") }', '${p.url}')" class="btn btn-outline">
                            <i class="fas fa-chart-line"></i> Historial
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Exponer función al window para el onclick del string template
    window.openHistory = async (id, nombre, url) => {
        currentProductId = id;
        document.getElementById('modalTitle').innerText = nombre;
        document.getElementById('productLink').href = url;
        modal.classList.add('active');
        
        // Destruir gráfica anterior si existe
        if (priceChart) priceChart.destroy();
        
        // Cargar datos de historial
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        try {
            const res = await fetch(`/api/productos/${id}/historial`);
            const data = await res.json();
            
            if (data.exito) {
                const precios = data.datos.reverse(); // Ordenar cronológicamente
                const labels = precios.map(h => new Date(h.fecha_captura).toLocaleDateString());
                const values = precios.map(h => h.precio);

                priceChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Precio (€)',
                            data: values,
                            borderColor: '#ff6000',
                            backgroundColor: 'rgba(255, 96, 0, 0.1)',
                            fill: true,
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando historial', error);
        }
    };

    async function updateProductPrice(id) {
        const btn = document.getElementById('forceUpdateBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        
        try {
            const res = await fetch(`/api/productos/${id}/actualizar-precio`, { method: 'POST' });
            const data = await res.json();
            
            if (data.exito) {
                showToast('Precio actualizado correctamente', 'success');
                // Recargar gráfica simulando click
                const nombre = document.getElementById('modalTitle').innerText;
                const url = document.getElementById('productLink').href;
                window.openHistory(id, nombre, url);
                loadAllProducts(); // Actualizar grids de fondo
            } else {
                showToast('No hubo cambios o error', 'error');
            }
        } catch (e) {
            showToast('Error al actualizar', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync"></i> Actualizar Precio Ahora';
        }
    }

    function closeModal() {
        modal.classList.remove('active');
        currentProductId = null;
    }

    function showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${msg}</span> <i class="fas fa-times" onclick="this.parentElement.remove()" style="cursor:pointer; margin-left:10px;"></i>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
});
