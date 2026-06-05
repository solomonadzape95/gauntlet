import { PassDetail } from "./pass-detail";

export default async function PassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PassDetail passId={id} />;
}
