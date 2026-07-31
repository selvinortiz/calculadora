import { redirect } from "next/navigation";

export default async function FinancingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  redirect(`/financiamientos/nuevo${params.size ? `?${params}` : ""}`);
}
