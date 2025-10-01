import { beginCell, Address, Cell } from "@ton/core";

export function packAddresses(addrs: string[]): Cell {
  const b = beginCell();
  b.storeUint(addrs.length, 16);
  for (const s of addrs) b.storeAddress(Address.parse(s));
  return b.endCell();
}
