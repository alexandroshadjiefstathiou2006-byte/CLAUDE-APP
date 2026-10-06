import { PageHeader } from "@/components/ui";
import { ProductForm } from "./product-form";

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Add product" subtitle="One great photo is all we need. We'll analyze it so your creatives stay true to the product." />
      <ProductForm />
    </>
  );
}
