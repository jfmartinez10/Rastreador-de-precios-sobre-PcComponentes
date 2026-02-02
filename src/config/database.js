import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DB_URL
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el cliente de PostgreSQL:', err);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('🔍 Query ejecutada:', { 
      text: text.substring(0, 60) + '...', 
      duration: `${duration}ms`, 
      rows: res.rowCount 
    });
    return res;
  } catch (error) {
    console.error('❌ Error en query:', error.message);
    throw error;
  }
};

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const testConnection = async () => {
  try {
    const res = await query('SELECT NOW() as now, version() as version');
    console.log('✅ Conexión a Supabase exitosa');
    console.log('📅 Fecha servidor:', res.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Error conectando a Supabase:', error.message);
    return false;
  }
};

export default {
  query,
  transaction,
  testConnection,
  pool
};