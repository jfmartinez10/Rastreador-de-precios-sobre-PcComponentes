import pg from 'pg';
const { Pool } = pg;

async function ejecutarMigracion() {
  console.log('\n' + '='.repeat(70));
  console.log('🔧 EJECUTANDO MIGRACIÓN: Agregar porcentaje_descuento');
  console.log('='.repeat(70) + '\n');

  const pool = new Pool({
    connectionString: process.env.DB_URL
  });

  try {
    console.log('📡 Conectando a Supabase...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa\n');

    console.log('🔨 Ejecutando migración...');
    
    // Agregar columna porcentaje_descuento
    const migration = `
      ALTER TABLE historial_precios 
      ADD COLUMN IF NOT EXISTS porcentaje_descuento DECIMAL(5, 2) DEFAULT NULL;
      
      COMMENT ON COLUMN historial_precios.porcentaje_descuento IS 'Porcentaje de descuento extraído directamente de PCComponentes';
    `;
    
    await pool.query(migration);
    
    console.log('✅ Columna porcentaje_descuento agregada correctamente\n');

    // Verificar que la columna existe
    const verificacion = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'historial_precios' 
        AND column_name = 'porcentaje_descuento'
    `);

    if (verificacion.rows.length > 0) {
      console.log('✅ Verificación exitosa:');
      console.log(`   Columna: ${verificacion.rows[0].column_name}`);
      console.log(`   Tipo: ${verificacion.rows[0].data_type}\n`);
    }

    console.log('='.repeat(70));
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(70) + '\n');

    console.log('📝 PRÓXIMOS PASOS:');
    console.log('   1. Ejecutar: npm run test-scraping');
    console.log('   2. Los nuevos productos incluirán el % de descuento');
    console.log('   3. Reiniciar el servidor: npm run dev\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error ejecutando migración:', error.message);
    console.error('\n💡 Verifica:');
    console.error('   1. Tu connection string de Supabase es correcta');
    console.error('   2. Tienes permisos para modificar el schema\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

ejecutarMigracion();