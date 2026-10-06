import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { NewCreatorForm } from "./new-creator-form";

export default function NewCreatorPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/app/creators" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> AI Creators
      </Link>
      <PageHeader
        title="Create AI Creator"
        subtitle="Describe your brand's creator. We'll generate fictional portraits to choose from, then lock in their identity so they look the same in every photo and video."
      />
      <NewCreatorForm />
    </div>
  );
}
