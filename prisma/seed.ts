/**
 * Seeds the stock AI creator library and a demo account.
 * Run: npm run db:seed   (idempotent)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { renderAvatarSvg } from "../src/server/render/svg";
import { storage } from "../src/server/storage";
import { applyCredits } from "../src/server/billing/credits";

const db = new PrismaClient();

type HairColor = "black" | "brown" | "blonde" | "red" | "grey" | "auburn";
type HairLen = "short" | "long" | "medium" | "curly" | "buzz";

const CREATORS: {
  name: string; gender: string; age: number; appearance: string; bodyType: string; hair: string; style: string;
  location: string; categories: string[]; bio: string; skin: number; hairColor: HairColor; hairLen: HairLen; bg: [string, string]; outfit: string;
}[] = [
  { name: "Sofia", gender: "female", age: 24, appearance: "Mediterranean, olive skin, warm brown eyes", bodyType: "slim", hair: "long dark brown", style: "casual", location: "London", categories: ["lifestyle", "fashion"], bio: "Effortless everyday looks. Coffee, vintage markets, city walks.", skin: 1, hairColor: "brown", hairLen: "long", bg: ["#F4E9E1", "#E6CFC0"], outfit: "#2E2E38" },
  { name: "Maya", gender: "female", age: 27, appearance: "Black woman, deep brown skin, bright smile", bodyType: "curvy", hair: "curly black", style: "streetwear", location: "New York", categories: ["streetwear", "fashion"], bio: "Sneakerhead, bold colors, Brooklyn energy.", skin: 4, hairColor: "black", hairLen: "curly", bg: ["#EDE7F8", "#D3C6F2"], outfit: "#C2410C" },
  { name: "Lena", gender: "female", age: 31, appearance: "Northern European, fair skin, light freckles", bodyType: "athletic", hair: "shoulder-length blonde", style: "minimal", location: "Copenhagen", categories: ["minimal", "luxury"], bio: "Clean lines, neutral palettes, slow fashion.", skin: 0, hairColor: "blonde", hairLen: "medium", bg: ["#EEF1F4", "#D5DCE4"], outfit: "#D6CFC4" },
  { name: "Aiko", gender: "female", age: 22, appearance: "Japanese, light skin, soft features", bodyType: "petite", hair: "straight black bob", style: "casual", location: "Tokyo", categories: ["lifestyle", "beauty"], bio: "Cute minimal outfits and GRWM mornings.", skin: 0, hairColor: "black", hairLen: "medium", bg: ["#FBEFF3", "#F2D3DE"], outfit: "#F5F0E6" },
  { name: "Priya", gender: "female", age: 29, appearance: "South Asian, medium brown skin, dark eyes", bodyType: "average", hair: "long black wavy", style: "luxury", location: "Dubai", categories: ["luxury", "fashion"], bio: "Elevated essentials and statement pieces.", skin: 3, hairColor: "black", hairLen: "long", bg: ["#F5EFE3", "#E6D6B6"], outfit: "#7C2D12" },
  { name: "Camila", gender: "female", age: 26, appearance: "Latina, tan skin, warm features", bodyType: "athletic", hair: "long auburn", style: "athletic", location: "Miami", categories: ["fitness", "beach"], bio: "Pilates, beach runs, athleisure all day.", skin: 2, hairColor: "auburn", hairLen: "long", bg: ["#E9F6F3", "#C4E7DE"], outfit: "#0F766E" },
  { name: "Ruth", gender: "female", age: 54, appearance: "White woman, fair skin, kind eyes, laugh lines", bodyType: "average", hair: "silver bob", style: "minimal", location: "Edinburgh", categories: ["lifestyle", "minimal"], bio: "Timeless wardrobe, quality over quantity.", skin: 0, hairColor: "grey", hairLen: "medium", bg: ["#F1F0EC", "#DCD9CF"], outfit: "#1E3A5F" },
  { name: "Marcus", gender: "male", age: 28, appearance: "Black man, dark brown skin, short beard", bodyType: "athletic", hair: "short fade", style: "streetwear", location: "Atlanta", categories: ["streetwear", "fitness"], bio: "Hoodies, sneakers and gym fits.", skin: 5, hairColor: "black", hairLen: "buzz", bg: ["#E7EBF2", "#C9D3E3"], outfit: "#111827" },
  { name: "Leo", gender: "male", age: 25, appearance: "Southern European, light olive skin, stubble", bodyType: "slim", hair: "medium brown tousled", style: "casual", location: "Barcelona", categories: ["lifestyle", "beach"], bio: "Linen shirts, beach towns, golden hour.", skin: 1, hairColor: "brown", hairLen: "short", bg: ["#F6EFE4", "#EAD9BF"], outfit: "#E7E1D6" },
  { name: "Kenji", gender: "male", age: 33, appearance: "East Asian, light skin, clean shaven", bodyType: "slim", hair: "short black", style: "minimal", location: "Seoul", categories: ["minimal", "fashion"], bio: "Tailored basics and monochrome outfits.", skin: 0, hairColor: "black", hairLen: "short", bg: ["#ECEDEF", "#D2D5DA"], outfit: "#374151" },
  { name: "Diego", gender: "male", age: 21, appearance: "Latino, tan skin, youthful", bodyType: "average", hair: "curly dark brown", style: "streetwear", location: "Los Angeles", categories: ["streetwear", "lifestyle"], bio: "Skate culture, graphic tees, thrift finds.", skin: 2, hairColor: "brown", hairLen: "curly", bg: ["#FDF1E7", "#F6D7BD"], outfit: "#4D7C0F" },
  { name: "James", gender: "male", age: 45, appearance: "White man, fair skin, salt-and-pepper beard", bodyType: "average", hair: "short greying", style: "luxury", location: "London", categories: ["luxury", "outdoor"], bio: "Classic menswear, weekends in the countryside.", skin: 0, hairColor: "grey", hairLen: "short", bg: ["#EFF0EA", "#D6D9CB"], outfit: "#3F3A2E" },
];

const DEMO_HOODIE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 900" width="800" height="900">
<rect width="800" height="900" fill="#F4F4F5"/>
<path d="M270 150c30-40 80-60 130-60s100 20 130 60l150 70c30 14 46 40 50 74l40 330c3 24-14 44-38 46l-50 4c-20 2-38-12-42-32l-40-230v360c0 24-20 44-44 44H244c-24 0-44-20-44-44V412l-40 230c-4 20-22 34-42 32l-50-4c-24-2-41-22-38-46l40-330c4-34 20-60 50-74z" fill="#16161A"/>
<path d="M330 120c20 60 120 60 140 0" stroke="#2A2A30" stroke-width="40" fill="none"/>
<path d="M360 170l-12 140M440 170l12 140" stroke="#E5E5E5" stroke-width="6"/>
<rect x="300" y="560" width="200" height="110" rx="14" fill="#1E1E24"/>
<text x="400" y="440" text-anchor="middle" font-family="Arial Black,Arial" font-size="64" font-weight="900" fill="#FFFFFF" letter-spacing="4">NORTH</text>
<text x="400" y="490" text-anchor="middle" font-family="Arial" font-size="26" fill="#A1A1AA" letter-spacing="10">EST. 2024</text>
</svg>`;

async function main() {
  const existing = await db.creator.count({ where: { workspaceId: null } });
  if (existing === 0) {
    for (const [i, c] of CREATORS.entries()) {
      const svg = renderAvatarSvg({ name: c.name, skinIndex: c.skin, hairColor: c.hairColor, hairLength: c.hairLen, bg: c.bg, outfit: c.outfit });
      const { url } = await storage().put({ folder: "stock/creators", data: Buffer.from(svg), mimeType: "image/svg+xml" });
      await db.creator.create({
        data: {
          name: c.name,
          gender: c.gender,
          age: c.age,
          appearance: c.appearance,
          bodyType: c.bodyType,
          hair: c.hair,
          style: c.style,
          location: c.location,
          categories: JSON.stringify(c.categories),
          bio: c.bio,
          identityPrompt: `${c.name}: ${c.gender === "female" ? "a woman" : "a man"}, ${c.appearance}, ${c.hair} hair`,
          seed: 1000 + i * 37,
          avatarUrl: url,
        },
      });
    }
    console.log(`Seeded ${CREATORS.length} stock creators`);
  }

  const email = "demo@studio.dev";
  if (!(await db.user.findUnique({ where: { email } }))) {
    const user = await db.user.create({ data: { email, name: "Demo Brand", passwordHash: await bcrypt.hash("demo1234", 10) } });
    const ws = await db.workspace.create({ data: { name: "North Apparel", plan: "growth" } });
    await db.membership.create({ data: { userId: user.id, workspaceId: ws.id, role: "owner" } });
    await db.brandKit.create({
      data: {
        workspaceId: ws.id,
        brandName: "North Apparel",
        colors: JSON.stringify(["#16161A", "#F4F4F5", "#5B4BFF"]),
        fonts: "Inter Tight",
        toneOfVoice: "Confident, understated, a little playful",
        targetCustomer: "Men and women 18–30 who like clean streetwear",
        categories: JSON.stringify(["hoodies", "tees", "outerwear"]),
      },
    });
    await db.$transaction((tx) => applyCredits(tx, { workspaceId: ws.id, delta: 500, reason: "manual" }));
    const { url } = await storage().put({ folder: `ws/${ws.id}/products`, data: Buffer.from(DEMO_HOODIE_SVG), mimeType: "image/svg+xml" });
    await db.product.create({
      data: {
        workspaceId: ws.id,
        name: "Black Logo Hoodie",
        description: "Heavyweight 400gsm cotton fleece hoodie in black, oversized fit, white NORTH chest logo print, kangaroo pocket.",
        category: "apparel",
        imageUrl: url,
        analysis: JSON.stringify({
          summary: "Oversized heavyweight black cotton fleece hoodie with white NORTH wordmark across chest and EST. 2024 below.",
          productType: "hoodie",
          colors: [{ name: "black", hex: "#16161A" }, { name: "white print", hex: "#FFFFFF" }],
          materials: ["400gsm cotton fleece"],
          logos: ["White 'NORTH' wordmark centered on chest, grey 'EST. 2024' beneath"],
          graphics: [],
          fit: "oversized, dropped shoulders",
          fidelityNotes: ["NORTH wordmark must remain legible, white, centered on chest", "Body color is near-black, not grey"],
          sellingPoints: ["Heavyweight feel", "Relaxed oversized fit", "Clean minimal branding"],
        }),
        analysisStatus: "completed",
      },
    });
    console.log(`Demo account: ${email} / demo1234`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
