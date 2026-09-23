"use client"; // error boundaries must be client components

import ErrorScreen from "@/components/ui/ErrorScreen";

export default function AdminError({ error, retry }) {
  return <ErrorScreen error={error} retry={retry} homeHref="/admin" />;
}
