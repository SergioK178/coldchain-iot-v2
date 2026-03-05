import { eq } from 'drizzle-orm';
import { type Db } from './client.js';
import { organizations, locations, zones, users } from './schema.js';

const DEFAULT_ORG_NAME = 'Default Organization';
const DEFAULT_LOCATION_NAME = 'Default Location';
const DEFAULT_ZONE_NAME = 'Default Zone';

export interface SeedOptions {
  adminEmail?: string;
  adminPasswordHash?: string;
}

export async function seed(db: Db, options?: SeedOptions) {
  // Idempotent: only insert if not exists
  const existingOrgs = await db.select().from(organizations).where(eq(organizations.name, DEFAULT_ORG_NAME));
  let orgId: string;
  if (existingOrgs.length === 0) {
    const [org] = await db.insert(organizations).values({ name: DEFAULT_ORG_NAME }).returning();
    orgId = org.id;
  } else {
    orgId = existingOrgs[0].id;
  }

  const existingLocations = await db.select().from(locations).where(eq(locations.name, DEFAULT_LOCATION_NAME));
  let locationId: string;
  if (existingLocations.length === 0) {
    const [loc] = await db.insert(locations).values({ orgId, name: DEFAULT_LOCATION_NAME }).returning();
    locationId = loc.id;
  } else {
    locationId = existingLocations[0].id;
  }

  const existingZones = await db.select().from(zones).where(eq(zones.name, DEFAULT_ZONE_NAME));
  if (existingZones.length === 0) {
    await db.insert(zones).values({ locationId, name: DEFAULT_ZONE_NAME });
  }

  // P2: seed admin user if users empty and options provided
  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (existingUsers.length === 0 && options?.adminEmail && options?.adminPasswordHash) {
    await db.insert(users).values({
      email: options.adminEmail.toLowerCase(),
      passwordHash: options.adminPasswordHash,
      role: 'admin',
    });
  }
}
