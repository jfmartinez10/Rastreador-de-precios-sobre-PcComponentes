// Variables globales
let productoId = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (!id) {
        mostrarToast('ID de producto no especificado', 'error');
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }

    productoId = parseInt(id);
    iniciarComparacion(productoId);
});

// Función principal que inicia la comparación
async function iniciarComparacion(id) {
    try {
        console.log(`🔍 Iniciando comparación para producto ID: ${id}`);
        
        // Mostrar pasos de carga
        mostrarPasoCarga('step1');
        
        // Llamar a la API de comparación
        const respuesta = await fetch(`/api/comparacion/${id}`);
        const data = await respuesta.json();

        if (!data.exito) {
            throw new Error(data.error || 'Error al obtener datos de comparación');
        }

        console.log('✅ Datos de comparación recibidos:', data);

        // Ocultar loading y mostrar resultados
        mostrarResultados(data.datos);

    } catch (error) {
        console.error('❌ Error en comparación:', error);
        mostrarError(error.message);
    }
}

// Mostrar paso de carga activo
function mostrarPasoCarga(stepId) {
    // Remover clase active de todos los pasos
    document.querySelectorAll('.loading-step').forEach(step => {
        step.classList.remove('active');
    });

    // Activar el paso actual
    const step = document.getElementById(stepId);
    if (step) {
        step.classList.add('active');
    }

    // Activar pasos en secuencia con delays
    const pasos = ['step1', 'step2', 'step3', 'step4'];
    const indiceActual = pasos.indexOf(stepId);
    
    if (indiceActual < pasos.length - 1) {
        setTimeout(() => {
            mostrarPasoCarga(pasos[indiceActual + 1]);
        }, 2000);
    }
}

// Mostrar resultados de la comparación
function mostrarResultados(datos) {
    console.log('📊 Mostrando resultados:', datos);

    const loadingContainer = document.getElementById('loadingContainer');
    const resultsContainer = document.getElementById('resultsContainer');

    if (!loadingContainer || !resultsContainer) {
        console.error('❌ Contenedores no encontrados');
        return;
    }

    // Ocultar loading, mostrar resultados
    loadingContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    // Construir HTML de resultados
    resultsContainer.innerHTML = `
        ${crearTarjetaProducto(datos.producto)}
        ${crearSeccionDatosInternos(datos.precioInterno)}
        ${crearSeccionFuentesExternas(datos.fuentesExternas)}
    `;
}

// Crear tarjeta de información del producto
function crearTarjetaProducto(producto) {
    return `
        <div class="product-info-card">
            <div class="product-info-header">
                <img src="${producto.imagen_url || 'https://via.placeholder.com/100'}" alt="${producto.nombre}">
                <div class="product-info-details">
                    <h2>${producto.nombre}</h2>
                    <a href="${producto.url}" target="_blank">
                        <i class="fas fa-external-link-alt"></i> Ver en PCComponentes
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Crear sección de datos internos
function crearSeccionDatosInternos(precioInterno) {
    return `
        <div class="internal-data-section">
            <h3 class="section-title">
                <i class="fas fa-database"></i> Datos Internos de Nuestro Rastreador
            </h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Precio Actual</div>
                    <div class="stat-value">${precioInterno.actual.toFixed(2)}€</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Precio Mínimo</div>
                    <div class="stat-value">${precioInterno.minimo.toFixed(2)}€</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Precio Máximo</div>
                    <div class="stat-value">${precioInterno.maximo.toFixed(2)}€</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Precio Promedio</div>
                    <div class="stat-value">${precioInterno.promedio.toFixed(2)}€</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Registros</div>
                    <div class="stat-value">${precioInterno.totalRegistros}</div>
                </div>
            </div>
        </div>
    `;
}

// Crear sección de fuentes externas - MEJORADO para mostrar productos relacionados
function crearSeccionFuentesExternas(fuentes) {
    const tarjetasFuentes = fuentes.map(fuente => {
        const tienePrecio = fuente.precio !== null && fuente.precio !== undefined;
        const claseCard = tienePrecio ? 'with-price' : 'no-price';
        
        let contenidoPrecio = '';
        if (tienePrecio) {
            contenidoPrecio = `<div class="source-price">${fuente.precio.toFixed(2)}€</div>`;
        } else {
            contenidoPrecio = `<div class="source-price no-price">No disponible</div>`;
        }

        const mensajeError = fuente.error ? `<p style="color: #dc3545; font-size: 0.85rem; margin-top: 0.5rem;">${fuente.error}</p>` : '';

        // Mostrar ASIN si está disponible (para CamelCamelCamel)
        let infoExtra = '';
        
        if (fuente.asin) {
            infoExtra += `
                <p style="color: #6c757d; font-size: 0.8rem; margin-top: 0.3rem;">
                    ASIN: ${fuente.asin}
                </p>
            `;
        }
        
        // NUEVO: Mostrar advertencia si es producto relacionado (no exacto)
        if (fuente.esExacto === false && fuente.mensaje) {
            infoExtra += `
                <div style="
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                    border-radius: 8px;
                    padding: 12px;
                    margin-top: 10px;
                    display: flex;
                    align-items: start;
                    gap: 10px;
                ">
                    <i class="fas fa-exclamation-triangle" style="color: #ff9800; font-size: 1.2rem; margin-top: 2px;"></i>
                    <div style="flex: 1;">
                        <p style="margin: 0; font-weight: 600; color: #856404; font-size: 0.9rem;">
                            ${fuente.mensaje}
                        </p>
                        ${fuente.titulo ? `
                            <p style="margin: 8px 0 0 0; color: #856404; font-size: 0.85rem;">
                                <strong>Producto encontrado:</strong><br>
                                ${fuente.titulo}
                            </p>
                        ` : ''}
                        ${fuente.porcentajeCoincidencia ? `
                            <p style="margin: 5px 0 0 0; color: #856404; font-size: 0.8rem;">
                                Coincidencia: ${fuente.porcentajeCoincidencia.toFixed(0)}%
                            </p>
                        ` : ''}
                    </div>
                </div>
            `;
        } else if (fuente.esExacto === true && fuente.porcentajeCoincidencia) {
            // Si es producto exacto, mostrar badge de verificado
            infoExtra += `
                <div style="
                    background: #d4edda;
                    border: 2px solid #28a745;
                    border-radius: 8px;
                    padding: 8px 12px;
                    margin-top: 10px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <i class="fas fa-check-circle" style="color: #28a745;"></i>
                    <span style="color: #155724; font-weight: 600; font-size: 0.85rem;">
                        Producto exacto verificado (${fuente.porcentajeCoincidencia.toFixed(0)}% coincidencia)
                    </span>
                </div>
            `;
        }

        return `
            <div class="source-card ${claseCard}">
                <div class="source-info">
                    <div class="source-icon">${fuente.icono}</div>
                    <div class="source-details">
                        <h3>${fuente.nombre}</h3>
                        ${fuente.url && tienePrecio ? `
                            <a href="${fuente.url}" target="_blank" style="color: #667eea;">
                                <i class="fas fa-external-link-alt"></i> Ver producto
                            </a>
                        ` : ''}
                        ${infoExtra}
                        ${mensajeError}
                    </div>
                </div>
                ${contenidoPrecio}
            </div>
        `;
    }).join('');

    return `
        <div class="external-sources-section">
            <h3 class="section-title">
                <i class="fas fa-globe"></i> Fuentes Externas Consultadas
            </h3>
            <div class="sources-grid">
                ${tarjetasFuentes}
            </div>
        </div>
    `;
}

// Mostrar error
function mostrarError(mensaje) {
    const loadingContainer = document.getElementById('loadingContainer');
    const resultsContainer = document.getElementById('resultsContainer');

    if (loadingContainer) loadingContainer.style.display = 'none';
    if (resultsContainer) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `
            <div class="analysis-section" style="text-align: center; padding: 4rem 2rem;">
                <div style="font-size: 4rem; color: #dc3545; margin-bottom: 1rem;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 style="color: #2c3e50; margin-bottom: 1rem;">Error en la Comparación</h2>
                <p style="color: #6c757d; font-size: 1.1rem; margin-bottom: 2rem;">
                    ${mensaje}
                </p>
                <button onclick="window.history.back()" class="btn btn-primary">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
            </div>
        `;
    }

    mostrarToast(mensaje, 'error');
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