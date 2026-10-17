import { createFileRoute } from "@tanstack/react-router";
import { BrookriverApp } from "@/components/brookriver-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BrookriverApp />;
}
