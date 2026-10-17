import { useEffect, useRef, useState } from "react";
import { deskKey, type Desk, type UiCmd } from "@/game/desk";
import { BankBoard, CarsBoard, CounterBoard, FixerBoard, HomeBoard, HousesBoard, JobsBoard, MugBoard, ShopsBoard } from "@/components/desk/boards";
import { BaccaratTable, BlackjackTable, CageBoard, CrapsTable, RouletteTable, SlotsTable } from "@/components/desk/tables";

export function DeskHost({
  desk,
  navSeq,
  navKey,
  send,
}: {
  desk: Desk;
  navSeq: number;
  navKey: string;
  send: (cmd: UiCmd) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(0);
  const [focus, setFocus] = useState(0);
  const key = deskKey(desk);
  const selected = desk.kind === "jobs" ? desk.selected : 0;

  useEffect(() => {
    const root = rootRef.current;
    const buttons = root ? [...root.querySelectorAll<HTMLButtonElement>("[data-desk]:not(:disabled)")] : [];
    const play = buttons.findIndex((button) => button.dataset.desk === "play");
    const next = play >= 0 ? play : selected;
    focusRef.current = next;
    setFocus(next);
  }, [key, selected]);

  useEffect(() => {
    if (!navSeq) return;
    const root = rootRef.current;
    if (!root) return;
    const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-desk]:not(:disabled)")];
    if (buttons.length === 0) return;
    if (navKey === "next") {
      const next = (focusRef.current + 1) % buttons.length;
      focusRef.current = next;
      setFocus(next);
      return;
    }
    if (navKey === "back") {
      send({ op: "close" });
      return;
    }
    if (navKey === "confirm") buttons[focusRef.current % buttons.length]?.click();
  }, [navSeq, navKey, send]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-desk]:not(:disabled)")];
    const count = Math.max(1, buttons.length);
    buttons.forEach((button, index) => {
      if (index === focus % count) button.dataset.on = "1";
      else delete button.dataset.on;
    });
  });

  return (
    <div ref={rootRef}>
      {desk.kind === "cars" ? <CarsBoard desk={desk} send={send} /> : null}
      {desk.kind === "houses" ? <HousesBoard desk={desk} send={send} /> : null}
      {desk.kind === "shops" ? <ShopsBoard desk={desk} send={send} /> : null}
      {desk.kind === "fixer" ? <FixerBoard desk={desk} send={send} /> : null}
      {desk.kind === "bank" ? <BankBoard desk={desk} send={send} /> : null}
      {desk.kind === "home" ? <HomeBoard desk={desk} send={send} /> : null}
      {desk.kind === "counter" ? <CounterBoard desk={desk} send={send} /> : null}
      {desk.kind === "jobs" ? <JobsBoard desk={desk} send={send} /> : null}
      {desk.kind === "mug" ? <MugBoard desk={desk} send={send} /> : null}
      {desk.kind === "blackjack" ? <BlackjackTable desk={desk} send={send} /> : null}
      {desk.kind === "roulette" ? <RouletteTable desk={desk} send={send} /> : null}
      {desk.kind === "slots" ? <SlotsTable desk={desk} send={send} /> : null}
      {desk.kind === "craps" ? <CrapsTable desk={desk} send={send} /> : null}
      {desk.kind === "baccarat" ? <BaccaratTable desk={desk} send={send} /> : null}
      {desk.kind === "cage" ? <CageBoard desk={desk} /> : null}
    </div>
  );
}
