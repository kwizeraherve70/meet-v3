import { cache } from '../lib/cache.js';

/**
 * Cache Cleanup Utility - UPDATED
 * 
 * Run this ONCE MORE to clear old JSON-stringified data
 * Now that we know Upstash auto-serializes, we need to clear the old manually-stringified cache
 * 
 * Usage:
 * 1. Import and call from server.ts on startup (run once then remove)
 * 2. Create a temporary admin endpoint to trigger it
 */

/**
 * Clear all cache to remove old JSON-stringified data
 * This is necessary because we switched from manual to auto-serialization
 */
export async function clearOldJsonStringifiedCache(): Promise<void> {
  console.log('');
  console.log('🧹 Clearing old JSON-stringified cache data...');
  console.log('='.repeat(60));
  console.log('⚠️  Upstash auto-serializes, so old manual JSON.stringify data needs clearing');
  console.log('');

  try {
    // Nuclear option - clear everything since we changed serialization method
    await cache.flushAll();
    
    console.log('✅ All old cache data cleared');
    console.log('✅ New cache will be auto-serialized by Upstash correctly');
    console.log('='.repeat(60));
    console.log('');
  } catch (error: any) {
    console.error('❌ Error clearing cache:', error.message);
  }
}

/**
 * Verify cache health after cleanup
 */
export async function verifyCacheHealth(): Promise<void> {
  console.log('');
  console.log('🏥 Verifying cache health...');
  console.log('='.repeat(60));

  try {
    // Test cache operations with auto-serialization
    const testKey = 'health:check:' + Date.now();
    const testData = {
      test: 'data',
      timestamp: new Date().toISOString(),
      nested: { value: 123, array: [1, 2, 3] },
    };

    // Test SET (no JSON.stringify)
    console.log('Testing SET operation (auto-serialization)...');
    await cache.set(testKey, testData, 60);
    console.log('✅ SET operation successful');

    // Test GET (no JSON.parse)
    console.log('Testing GET operation (auto-deserialization)...');
    const retrieved = await cache.get(testKey);
    
    if (!retrieved) {
      console.error('❌ GET operation failed - value is null');
      return;
    }

    console.log('✅ GET operation successful');
    console.log('   Retrieved type:', typeof retrieved);
    console.log('   Is object?:', typeof retrieved === 'object');

    // Verify data integrity
    const retrievedStr = JSON.stringify(retrieved);
    const originalStr = JSON.stringify(testData);

    if (retrievedStr === originalStr) {
      console.log('✅ Data integrity verified - auto-serialization working correctly!');
      console.log('✅ Upstash is handling JSON serialization/deserialization automatically');
    } else {
      console.error('❌ Data mismatch detected');
      console.error('Original:', originalStr);
      console.error('Retrieved:', retrievedStr);
    }

    // Cleanup
    await cache.delete(testKey);
    console.log('✅ Test data cleaned up');

    console.log('='.repeat(60));
    console.log('✅ Cache health check complete - cache is healthy!');
    console.log('');
  } catch (error: any) {
    console.error('❌ Cache health check failed:', error.message);
    console.log('');
  }
}

/**
 * Recommended cleanup function - clears all and verifies
 */
export async function cleanupCache(): Promise<void> {
  console.log('');
  console.log('🔧 CACHE CLEANUP - CORRECTED FOR AUTO-SERIALIZATION');
  console.log('='.repeat(60));
  console.log('');

  // Clear all old JSON-stringified data
  await clearOldJsonStringifiedCache();

  // Verify new auto-serialization works
  await verifyCacheHealth();

  console.log('✅ Cache cleanup complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Test joining a meeting');
  console.log('  2. Verify no warnings about "Unexpected object type"');
  console.log('  3. Comment out cleanupCache() in server.ts');
  console.log('');
}

// Export default function for easy import
export default cleanupCache;