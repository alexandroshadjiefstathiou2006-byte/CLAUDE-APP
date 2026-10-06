/**
 * Seeds the stock AI creator library and a demo account.
 * Run: npm run db:seed   (idempotent). The app also does this automatically on first use.
 */
import "dotenv/config";
import { seedDatabase } from "../src/server/seed-data";
import { db } from "../src/lib/db";

seedDatabase()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
