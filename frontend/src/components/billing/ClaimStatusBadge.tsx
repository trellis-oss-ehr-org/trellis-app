// ---------------------------------------------------------------------------
// ClaimStatusBadge — reusable pill badge for claim/superbill status
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
  generated: { bg: "bg-gray-100", text: "text-gray-700", label: "Generated" },
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Pending" },
  submitted: { bg: "bg-blue-50", text: "text-blue-700", label: "Submitted" },
  acknowledged: { bg: "bg-blue-50", text: "text-blue-700", label: "Acknowledged" },
  accepted: { bg: "bg-teal-50", text: "text-teal-700", label: "Accepted" },
  rejected: { bg: "bg-red-50", text: "text-red-700", label: "Rejected" },
  paid: { bg: "bg-green-50", text: "text-green-700", label: "Paid" },
  denied: { bg: "bg-red-50", text: "text-red-700", label: "Denied" },
  partially_paid: { bg: "bg-amber-50", text: "text-amber-700", label: "Partially Paid" },
  appealed: { bg: "bg-purple-50", text: "text-purple-700", label: "Appealed" },
  outstanding: { bg: "bg-red-50", text: "text-red-700", label: "Outstanding" },
};

interface ClaimStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export default function ClaimStatusBadge({ status, size = "sm" }: ClaimStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: status,
  };

  const sizeClasses =
    size === "md"
      ? "px-3 py-1 text-xs"
      : "px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}
