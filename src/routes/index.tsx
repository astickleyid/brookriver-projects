import { createFileRoute } from "@tanstack/react-router";
import { ViceroyApp } from "@/components/viceroy-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ViceroyApp />;
}
