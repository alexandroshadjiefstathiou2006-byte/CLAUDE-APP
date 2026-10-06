import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { requireContext } from "@/server/auth";
import { PageHeader } from "@/components/ui";
import { BrandKitForm } from "./brand-form";

export default async function BrandPage() {
  const { workspace } = await requireContext();
  const [kit, creators] = await Promise.all([
    db.brandKit.findUnique({ where: { workspaceId: workspace.id } }),
    db.creator.findMany({ where: { OR: [{ workspaceId: null }, { workspaceId: workspace.id }] }, select: { id: true, name: true, avatarUrl: true } }),
  ]);
  return (
    <>
      <PageHeader title="Brand Kit" subtitle="Every generation automatically follows your brand — colors, tone of voice and audience." />
      <BrandKitForm
        creators={creators}
        initial={{
          brandName: kit?.brandName ?? workspace.name,
          logoUrl: kit?.logoUrl ?? null,
          colors: parseJson<string[]>(kit?.colors, []),
          fonts: kit?.fonts ?? "",
          toneOfVoice: kit?.toneOfVoice ?? "",
          targetCustomer: kit?.targetCustomer ?? "",
          categories: parseJson<string[]>(kit?.categories, []),
          preferredStyles: parseJson<string[]>(kit?.preferredStyles, []),
          preferredCreatorIds: parseJson<string[]>(kit?.preferredCreatorIds, []),
        }}
      />
    </>
  );
}
