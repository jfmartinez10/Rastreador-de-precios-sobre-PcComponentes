-- Eliminar tablas si existen (en orden inverso por dependencias)
DROP TABLE IF EXISTS alertas CASCADE;
DROP TABLE IF EXISTS historial_precios CASCADE;
DROP TABLE IF EXISTS productos CASCADE;

-- Tabla: productos
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(500) NOT NULL,
    url TEXT NOT NULL UNIQUE,
    tienda VARCHAR(100) NOT NULL DEFAULT 'PCComponentes',
    categoria VARCHAR(100),
    imagen_url TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: historial_precios
CREATE TABLE historial_precios (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    precio DECIMAL(10, 2) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'EUR',
    disponible BOOLEAN DEFAULT true,
    estado_stock VARCHAR(50),
    porcentaje_descuento DECIMAL(5, 2) DEFAULT NULL, 
    fecha_captura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Tabla: alertas
CREATE TABLE alertas (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo_alerta VARCHAR(50) NOT NULL,
    umbral DECIMAL(10, 2),
    porcentaje_umbral DECIMAL(5, 2),
    activa BOOLEAN DEFAULT true,
    email_notificacion VARCHAR(255),
    ultima_activacion TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_producto_alerta FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Comentarios en columnas
COMMENT ON COLUMN historial_precios.porcentaje_descuento IS 'Porcentaje de descuento extraído directamente de PCComponentes (badge rojo)';
COMMENT ON TABLE productos IS 'Productos monitoreados de PCComponentes';
COMMENT ON TABLE historial_precios IS 'Histórico de precios y descuentos de productos';
COMMENT ON TABLE alertas IS 'Alertas configuradas por usuario (funcionalidad futura)';

-- Verificación
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as num_columnas
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;