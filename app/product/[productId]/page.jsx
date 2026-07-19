import { redirect } from "next/navigation";

export default async function ProductDeepLinkPage({ params }) {
  const { productId } = await params;
  redirect(`/?product=${encodeURIComponent(productId)}`);
}
