/**
 * Standalone (re-)seed script.
 *
 *   npm run seed:superadmin                    → create protected superadmin if missing
 *   npm run seed:superadmin -- --force-reset   → re-hash its password from .env
 *
 * --force-reset is the ONLY sanctioned way to rotate the protected
 * superadmin's credentials. Update .env first, then run it.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function run() {
  const forceReset = process.argv.includes('--force-reset');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const seeder = app.get(SeedService);
    await seeder.ensureSuperadmin(forceReset);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
