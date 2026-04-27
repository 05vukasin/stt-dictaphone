import { RecordingDetail } from "@/components/recording/recording-detail";

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordingDetail id={id} />;
}
