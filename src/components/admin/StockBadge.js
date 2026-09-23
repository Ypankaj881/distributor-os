import Badge from "@/components/ui/Badge";
import { stockStatus } from "@/lib/inventory";

export default function StockBadge({ quantity, threshold, unit }) {
  const status = stockStatus(quantity, threshold);
  const tone = status === "out" ? "red" : status === "low" ? "amber" : "green";
  return (
    <Badge tone={tone}>
      {quantity} {unit}
      {status === "out" ? " · Out" : status === "low" ? " · Low" : ""}
    </Badge>
  );
}
