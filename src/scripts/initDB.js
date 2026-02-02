import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function initDatabase() {
  console.log('\n' + '='.repeat(60));
  console.log('🗄️  INICIALIZANDO BASE DE DATOS SUPABASE');
  console.log('='.repeat(60) + '\n');

  // Conectar a Supabase
  const pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Verificar conexión
    console.log('📡 Conectando a Supabase...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa\n');

    // Leer schema SQL
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    console.log('📄 Leyendo schema desde:', schemaPath);
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema leído correctamente\n');

    // Ejecutar schema
    console.log('🔨 Ejecutando schema SQL...');
    await pool.query(schema);
    console.log('✅ Tablas creadas correctamente\n');

    // Verificar tablas creadas
    console.log('🔍 Verificando tablas creadas...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('\n📋 Tablas en Supabase:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ BASE DE DATOS INICIALIZADA CORRECTAMENTE');
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error inicializando base de datos:', error.message);
    console.error('\n💡 Verifica:');
    console.error('   1. Tu connection string de Supabase es correcta');
    console.error('   2. Las credenciales en .env son correctas');
    console.error('   3. La base de datos en Supabase existe');
    console.error('\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();