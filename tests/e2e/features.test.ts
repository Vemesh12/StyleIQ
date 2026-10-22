import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, BASE, Client, cleanup, newUser, prisma, TAG } from './helpers';

const today = new Date().toISOString().slice(0, 10);
type Outfit = { score: number; shirt: { id: string }; trouser: { id: string }; shoe: { id: string }; layer: { id: string } | null; belt: { id: string } | null };
const ids = (o: Outfit) => [o.shirt, o.layer, o.trouser, o.shoe, o.belt].filter((p): p is { id: string } => !!p).map((p) => p.id);

let alice: Awaited<ReturnType<typeof newUser>>;
let bob: Awaited<ReturnType<typeof newUser>>;
let closet: string[] = [];

beforeAll(async () => {
  const health = await fetch(BASE).catch(() => null);
  if (!health?.ok) throw new Error(`App is not reachable at ${BASE}. Start it with "npm run dev" (or set E2E_BASE_URL).`);
  alice = await newUser('alice');
  bob = await newUser('bob');
  // A realistic small closet from the catalog: tops, bottoms, shoes, a layer, a belt.
  const pick = async (type: string, n: number) =>
    (await prisma.garment.findMany({ where: { ownerId: null, garmentType: { slug: type } }, orderBy: { slug: 'asc' }, take: n })).map((g) => g.id);
  closet = [...(await pick('shirt', 4)), ...(await pick('trouser', 3)), ...(await pick('shoe', 3)), ...(await pick('jacket', 1)), ...(await pick('belt', 2))];
  const res = await alice.client.post('/api/user/wardrobe', { garmentIds: closet });
  expect(res.status).toBe(201);
});

afterAll(cleanup);

describe('platform', () => {
  it('blocks cross-site writes (CSRF) but allows same-site ones', async () => {
    const evil = await alice.client.post('/api/user/feedback', { garmentIds: closet.slice(0, 2), rating: 1 }, { origin: 'https://evil.example' });
    expect(evil.status).toBe(403);
    const ok = await alice.client.post('/api/user/feedback', { garmentIds: closet.slice(0, 2), rating: 0 });
    expect(ok.status).toBe(200);
  });

  it('still keeps user tokens out of admin APIs', async () => {
    const forged = new Client();
    forged.cookie = alice.client.cookie.replace('styleiq-user-token', 'styleiq-admin-token');
    expect((await forged.get('/api/admin/garments')).status).toBe(401);
  });
});

describe('style profile on the account', () => {
  it('saves the profile and returns it on sign-in', async () => {
    const profile = { skinTone: 'Medium', underTone: 'Warm', bodyProportion: 'Rectangle', hairColor: '' };
    expect((await alice.client.put('/api/user/profile', { profile })).status).toBe(200);
    const me = await alice.client.get('/api/auth/me');
    expect(me.data.styleProfile).toEqual({ skinTone: 'Medium', underTone: 'Warm', bodyProportion: 'Rectangle' });
    expect((await new Client().put('/api/user/profile', { profile })).status).toBe(401);
  });
});

describe("users' own items", () => {
  let ownId = '';
  let ownSlug = '';

  it('creates a private item and puts it in the closet', async () => {
    const res = await alice.client.post('/api/user/garments', {
      name: 'My Rust Corduroy Overshirt',
      typeSlug: 'jacket',
      colorSlugs: ['rust', 'camel'],
      formalityLevel: 2,
      materialSlug: 'corduroy',
      seasonProfile: 'heavy',
    });
    expect(res.status).toBe(201);
    ownId = res.data.id;
    ownSlug = res.data.slug;
    expect(res.data.ownerId).toBe(alice.id);
    const wardrobe = await alice.client.get('/api/user/wardrobe');
    expect(wardrobe.data.some((w: { garmentId: string }) => w.garmentId === ownId)).toBe(true);
  });

  it('never leaks into the public catalog', async () => {
    const list = await new Client().get('/api/garments?limit=200');
    expect(list.data.garments.some((g: { id: string }) => g.id === ownId)).toBe(false);
    expect((await new Client().get(`/api/garments/${ownSlug}`)).status).toBe(404);
    expect((await new Client().get(`/encyclopedia/${ownSlug}`)).status).toBe(404);
    const sitemap = await new Client().get('/sitemap.xml');
    expect(String(sitemap.data)).not.toContain(ownSlug);
    expect((await (await adminClient()).get('/api/admin/garments')).data.some((g: { id: string }) => g.id === ownId)).toBe(false);
  });

  it("can't be used or deleted by another user", async () => {
    expect((await bob.client.post('/api/user/wardrobe', { garmentId: ownId })).status).toBe(404);
    expect((await bob.client.del(`/api/user/garments?id=${ownId}`)).status).toBe(404);
  });

  it('is used by "complete my outfit" when locked', async () => {
    const res = await alice.client.post('/api/wardrobe/complete', {
      garmentIds: [...closet, ownId],
      lockedIds: [ownId],
      localDate: today,
    });
    expect(res.status).toBe(200);
    expect(res.data.outfits.length).toBeGreaterThan(0);
    for (const o of res.data.outfits as Outfit[]) expect(o.layer?.id).toBe(ownId);
  });
});

describe('complete my outfit', () => {
  it('builds every result around the locked pieces', async () => {
    const [shirt] = closet;
    const res = await alice.client.post('/api/wardrobe/complete', { garmentIds: closet, lockedIds: [shirt], localDate: today });
    expect(res.status).toBe(200);
    for (const o of res.data.outfits as Outfit[]) expect(o.shirt.id).toBe(shirt);
  });

  it('rejects locked items that are not in the closet', async () => {
    const res = await alice.client.post('/api/wardrobe/complete', { garmentIds: closet.slice(1), lockedIds: [closet[0]] });
    expect(res.status).toBe(400);
  });
});

describe('feedback and wear history shape the daily suggestion', () => {
  const daily = (c: Client) => c.post('/api/wardrobe/daily-suggestion', { garmentIds: closet, localDate: today });

  it('stops suggesting an outfit after a thumbs down', async () => {
    const first = (await daily(alice.client)).data.outfit as Outfit;
    expect((await alice.client.post('/api/user/feedback', { garmentIds: ids(first), rating: -1 })).status).toBe(200);
    const second = (await daily(alice.client)).data.outfit as Outfit;
    expect(ids(second).sort().join()).not.toBe(ids(first).sort().join());
  });

  it('logs what was worn and rotates away from it', async () => {
    const pick = (await daily(bob.client)).data.outfit as Outfit;
    const logged = await bob.client.post('/api/user/wear-log', { garmentIds: ids(pick), wornOn: today, outfitScore: pick.score });
    expect(logged.status).toBe(201);
    const history = await bob.client.get('/api/user/wear-log?days=7');
    expect(history.data[0].items.map((i: { id: string }) => i.id).sort()).toEqual(ids(pick).sort());
    const next = (await daily(bob.client)).data.outfit as Outfit;
    expect(next.shirt.id === pick.shirt.id && next.trouser.id === pick.trouser.id).toBe(false);
    expect((await bob.client.del(`/api/user/wear-log?id=${history.data[0].id}`)).status).toBe(200);
  });

  it('rejects future dates and other users\' entries', async () => {
    expect((await bob.client.post('/api/user/wear-log', { garmentIds: closet.slice(0, 3), wornOn: '2999-01-01' })).status).toBe(400);
    const entry = await alice.client.post('/api/user/wear-log', { garmentIds: closet.slice(0, 3), wornOn: today });
    expect((await bob.client.del(`/api/user/wear-log?id=${entry.data.id}`)).status).toBe(404);
  });
});

describe('what should I buy next', () => {
  it('suggests shoes to a closet without any', async () => {
    const noShoes = await prisma.garment.findMany({ where: { id: { in: closet }, garmentType: { slug: { not: 'shoe' } } }, select: { id: true } });
    const res = await new Client().post('/api/wardrobe/gaps', { garmentIds: noShoes.map((g) => g.id) });
    expect(res.status).toBe(200);
    expect(res.data.currentGoodOutfits).toBe(0);
    expect(res.data.suggestions[0].typeSlug).toBe('shoe');
    expect(res.data.suggestions[0].newOutfits).toBeGreaterThan(0);
  });
});

describe('admin: color rules', () => {
  it('creates a rule, updates it from the reverse direction, and deletes it', async () => {
    const admin = await adminClient();
    const [a, b] = await prisma.color.findMany({ where: { slug: { in: ['lilac', 'olive-green'] } }, orderBy: { slug: 'asc' } });
    const created = await admin.post('/api/admin/color-rules', { colorA: a.slug, colorB: b.slug, score: 4, harmony: 'Clash', reason: `${TAG}` });
    expect(created.status).toBe(201);
    const updated = await admin.post('/api/admin/color-rules', { colorA: b.slug, colorB: a.slug, score: 7.5, harmony: 'Muted Mismatch', reason: `${TAG}` });
    expect(updated.status).toBe(200);
    expect(updated.data.id).toBe(created.data.id);
    expect(updated.data.score).toBe(7.5);
    expect((await admin.post('/api/admin/color-rules', { colorA: a.slug, colorB: a.slug, score: 5, harmony: 'x' })).status).toBe(400);
    expect((await admin.del(`/api/admin/color-rules?id=${created.data.id}`)).status).toBe(200);
  });
});

describe('admin: bulk import', () => {
  it('reports every bad row and writes nothing', async () => {
    const admin = await adminClient();
    const csv = `name,type,formality,colors\n${TAG} Good Shirt,shirt,3,white\nBad Type,spaceship,3,white\n${TAG} Bad Color,shirt,9,not-a-color`;
    const res = await admin.post('/api/admin/import', { kind: 'garments', csv, dryRun: false });
    expect(res.status).toBe(422);
    expect(res.data.errors.map((e: { line: number }) => e.line)).toEqual([3, 4]);
    expect(await prisma.garment.count({ where: { name: { startsWith: TAG } } })).toBe(0);
  });

  it('dry-runs, then imports a valid file in one go', async () => {
    const admin = await adminClient();
    const csv = `slug,name,type,formality,colors,material,season\n${TAG}-linen-shirt,"${TAG} Linen Shirt, Navy",shirt,3,navy-blue;white,linen,light`;
    const dry = await admin.post('/api/admin/import', { kind: 'garments', csv, dryRun: true });
    expect(dry.data).toMatchObject({ rows: 1, created: 1, written: false, errors: [] });
    expect(await prisma.garment.count({ where: { slug: `${TAG}-linen-shirt` } })).toBe(0);

    const real = await admin.post('/api/admin/import', { kind: 'garments', csv, dryRun: false });
    expect(real.data).toMatchObject({ created: 1, written: true });
    const g = await prisma.garment.findUnique({
      where: { slug: `${TAG}-linen-shirt` },
      include: { colors: { include: { color: true } }, materials: { include: { material: true } }, occasions: true },
    });
    expect(g?.name).toBe(`${TAG} Linen Shirt, Navy`);
    expect(g?.colors.find((c) => c.isPrimary)?.color.slug).toBe('navy-blue');
    expect(g?.materials[0].material.slug).toBe('linen');
    expect(g?.occasions.length).toBeGreaterThan(0);
  });
});
