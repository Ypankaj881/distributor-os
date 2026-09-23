import Badge from "@/components/ui/Badge";
import { STOCK_LABELS } from "@/lib/inventory";

const TONES = { in: "green", low: "amber", out: "red" };

export default function AvailabilityBadge({ availability }) {
  return <Badge tone={TONES[availability]}>{STOCK_LABELS[availability]}</Badge>;
}
