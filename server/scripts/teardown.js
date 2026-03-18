#!/usr/bin/env node
/**
 * Teardown script for Travel Together
 * Removes all test data created by seed.js
 * 
 * Usage:
 *   node scripts/teardown.js              # Teardown local database
 *   node scripts/teardown.js --prod       # Teardown production database
 *   node scripts/teardown.js --dry-run    # Preview without deleting
 *   node scripts/teardown.js --all        # Delete ALL data (not just test data)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const TEST_EMAIL_DOMAIN = 'test.traveltogether.com';

async function teardown(options = {}) {
  const isProd = options.prod || process.argv.includes('--prod');
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const deleteAll = options.all || process.argv.includes('--all');
  
  const connectionString = isProd 
    ? process.env.DATABASE_URL 
    : (process.env.DATABASE_URL_LOCAL || 'postgresql://localhost:5432/travel_together');
  
  console.log(`\n🧹 Tearing down ${isProd ? 'PRODUCTION' : 'LOCAL'} database...`);
  console.log(`   Connection: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  if (isDryRun) console.log('   (DRY RUN - no data will be deleted)\n');
  if (deleteAll) console.log('   ⚠️  WARNING: Deleting ALL data, not just test data!\n');

  // Safety confirmation for production
  if (isProd && !isDryRun) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question(`\n⚠️  You are about to delete ${deleteAll ? 'ALL' : 'test'} data from PRODUCTION.\n   Type 'yes' to confirm: `, resolve);
    });
    rl.close();
    
    if (answer !== 'yes') {
      console.log('\n❌ Aborted.\n');
      process.exit(0);
    }
  }

  const pool = new Pool({ 
    connectionString,
    ssl: isProd ? { rejectUnauthorized: false } : false
  });

  try {
    // Get test user IDs
    let userIds = [];
    let userCondition = '';
    
    if (!deleteAll) {
      const usersResult = await pool.query(
        `SELECT id, username FROM users WHERE email LIKE $1`,
        [`%@${TEST_EMAIL_DOMAIN}`]
      );
      userIds = usersResult.rows.map(r => r.id);
      
      if (userIds.length === 0) {
        console.log('\n✅ No test users found. Nothing to delete.\n');
        await pool.end();
        return;
      }
      
      console.log(`\n📋 Found ${usersResult.rows.length} test users:`);
      usersResult.rows.forEach(r => console.log(`   - ${r.username}`));
      
      userCondition = `WHERE user_id = ANY($1)`;
    }
    
    // Delete in order due to foreign key constraints
    console.log('\n🗑️  Deleting data...');
    
    // 1. Delete city visits
    if (!isDryRun) {
      const result = deleteAll
        ? await pool.query('DELETE FROM city_visits')
        : await pool.query(`DELETE FROM city_visits ${userCondition}`, [userIds]);
      console.log(`   - Deleted ${result.rowCount} city visits`);
    }
    
    // 2. Delete country visits
    if (!isDryRun) {
      const result = deleteAll
        ? await pool.query('DELETE FROM country_visits')
        : await pool.query(`DELETE FROM country_visits ${userCondition}`, [userIds]);
      console.log(`   - Deleted ${result.rowCount} country visits`);
    }
    
    // 3. Delete wishlist
    if (!isDryRun) {
      const result = deleteAll
        ? await pool.query('DELETE FROM country_wishlist')
        : await pool.query(`DELETE FROM country_wishlist ${userCondition}`, [userIds]);
      console.log(`   - Deleted ${result.rowCount} wishlist items`);
    }
    
    // 4. Delete friendships
    if (!isDryRun) {
      let result;
      if (deleteAll) {
        result = await pool.query('DELETE FROM friendships');
      } else {
        result = await pool.query(
          `DELETE FROM friendships WHERE user_id_1 = ANY($1) OR user_id_2 = ANY($1)`,
          [userIds]
        );
      }
      console.log(`   - Deleted ${result.rowCount} friendships`);
    }
    
    // 5. Delete password reset tokens
    if (!isDryRun) {
      const result = deleteAll
        ? await pool.query('DELETE FROM password_reset_tokens')
        : await pool.query(`DELETE FROM password_reset_tokens ${userCondition}`, [userIds]);
      console.log(`   - Deleted ${result.rowCount} password reset tokens`);
    }
    
    // 6. Delete users
    if (!isDryRun) {
      let result;
      if (deleteAll) {
        result = await pool.query('DELETE FROM users');
      } else {
        result = await pool.query(
          `DELETE FROM users WHERE id = ANY($1)`,
          [userIds]
        );
      }
      console.log(`   - Deleted ${result.rowCount} users`);
    }

    console.log('\n✅ Teardown complete!\n');
    
  } catch (error) {
    console.error('\n❌ Teardown failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  teardown();
}

module.exports = { teardown };

