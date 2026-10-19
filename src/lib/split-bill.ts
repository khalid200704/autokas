import type { TransactionItem } from "@/lib/mock-data";

export type SplitMode = "items" | "equal";

export type SplitPerson = {
  name: string;
  amount: number;
  items: { name: string; amount: number }[];
};

export function calculateSplit(
  total: number,
  items: TransactionItem[],
  itemIds: string[],
  participantNames: string[],
  assignments: Record<string, string>,
  sharedCharge: number,
  mode: SplitMode
): SplitPerson[] {
  const people = participantNames.map((name) => ({
    name,
    amountCents: 0,
    itemCents: [] as { name: string; amountCents: number }[],
  }));
  if (people.length === 0) return [];

  const toCents = (value: number) => Math.round(value * 100);
  const totalCents = toCents(Math.max(0, total));

  if (mode === "equal") {
    const baseCents = Math.floor(totalCents / people.length);
    let remainder = totalCents - baseCents * people.length;
    people.forEach((person) => {
      person.amountCents = baseCents + (remainder-- > 0 ? 1 : 0);
    });
  } else {
    let assignedTotalCents = 0;
    items.forEach((item, index) => {
      const person = people.find((entry) => entry.name === assignments[itemIds[index]]);
      if (!person) return;
      const amountCents = toCents(Number(item.price) * Number(item.qty));
      person.amountCents += amountCents;
      person.itemCents.push({ name: item.item_name, amountCents });
      assignedTotalCents += amountCents;
    });

    const sharedChargeCents = toCents(Math.max(0, sharedCharge));
    const remainderCents = Math.max(0, totalCents - assignedTotalCents - sharedChargeCents);
    const assignedBases = people.reduce((sum, person) => sum + person.amountCents, 0);
    const weights = people.map((person) => (
      assignedBases > 0 ? person.amountCents / assignedBases : 1 / people.length
    ));
    const rawChargeShares = weights.map((weight) => sharedChargeCents * weight);
    const chargeShares = rawChargeShares.map(Math.floor);
    distributeRemainder(
      sharedChargeCents - chargeShares.reduce((sum, amount) => sum + amount, 0),
      chargeShares,
      rawChargeShares.map((amount, index) => amount - chargeShares[index])
    );

    const equalRemainderShare = Math.floor(remainderCents / people.length);
    let remainder = remainderCents - equalRemainderShare * people.length;
    people.forEach((person, index) => {
      person.amountCents += chargeShares[index] + equalRemainderShare + (remainder-- > 0 ? 1 : 0);
    });
  }

  return people.map((person) => ({
    name: person.name,
    amount: person.amountCents / 100,
    items: person.itemCents.map((item) => ({ name: item.name, amount: item.amountCents / 100 })),
  }));
}

function distributeRemainder(remainder: number, shares: number[], fractionalShares: number[]) {
  if (remainder <= 0) return;
  const order = fractionalShares
    .map((fraction, index) => ({ index, fraction }))
    .sort((first, second) => second.fraction - first.fraction);
  for (let index = 0; index < remainder; index += 1) {
    shares[order[index % order.length].index] += 1;
  }
}
