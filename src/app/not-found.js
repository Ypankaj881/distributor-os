import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <EmptyState
        icon="search"
        title="Page not found"
        description="This page doesn't exist or isn't available yet."
        action={<Button href="/">Go to home</Button>}
      />
    </div>
  );
}
