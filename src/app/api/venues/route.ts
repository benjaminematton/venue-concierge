import { listVenueSummaries } from "@/lib/venues";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ venues: listVenueSummaries() });
}
