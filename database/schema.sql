-- Eliminar tablas si existen
DROP TABLE IF EXISTS alertas CASCADE;
DROP TABLE IF EXISTS historial_precios CASCADE;
DROP TABLE IF EXISTS productos CASCADE;

-- Tabla de productos monitorizados
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    url TEXT NOT NULL UNIQUE,
    tienda VARCHAR(100) NOT NULL,
    categoria VARCHAR(100),
    imagen_url TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de histórico de precios
CREATE TABLE historial_precios (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    precio DECIMAL(10, 2) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'EUR',
    disponible BOOLEAN DEFAULT true,
    estado_stock VARCHAR(50),
    fecha_captura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Tabla de alertas
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