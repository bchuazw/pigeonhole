// scripts/mintMockItem.ts
import { Address, beginCell, toNano, Cell } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { GachaDispenser } from "../build/GachaDispenser/GachaDispenser_GachaDispenser";
import { MockNftItem } from "../build/MockNftItem/MockNftItem_MockNftItem";

// --- tiny helpers (no external deps) ---
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
async function withRetry<T>(fn: () => Promise<T>, tries = 5, pauseMs = 2500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await delay(pauseMs); }
  }
  throw last;
}

function packAddresses(addrs: string[]): Cell {
  if (addrs.length > 3) throw new Error("packAddresses: limit 3 per batch");
  const b = beginCell();
  b.storeUint(addrs.length, 16);
  for (const s of addrs) b.storeAddress(Address.parse(s));
  return b.endCell();
}

export async function run(provider: NetworkProvider) {
  // 0) open the gacha
  const gachaAddr = Address.parse(process.env.GACHA_ADDR!);
  const gacha = provider.open(GachaDispenser.fromAddress(gachaAddr));
  provider.ui().write(`Using gacha: ${gacha.address.toString()}`);

  // 1) prepare mock item init
  const owner: Address = gacha.address; // mint to gacha so it can transfer out on roll
  const content: Cell = beginCell().storeStringTail("mock://demo1").endCell();
  const nonce: bigint = BigInt(Math.floor(Date.now() / 1000)); // any unique bigint

  // 2) create a contract instance from init (pick the correct overload for your binding)
  // --- OPTION A: common in recent tact bindings: fromInit(nonce, { owner, content })
  // const item = provider.open(await MockNftItem.fromInit(nonce, { owner, content }));

  // --- OPTION B: some bindings: fromInit({ owner, content }, nonce)
    const item = provider.open(
    await MockNftItem.fromInit(owner, content, nonce)
    );
  provider.ui().write(`Deploying item: ${item.address.toString()}`);

  // 3) fund & send the item's init message (our Mock item expects SetOwner(op,newOwner))
  await withRetry(async () => {
    await item.send(
      provider.sender(),
      { value: toNano("0.05") },         // tiny deploy+gas
      {
        $$type: "SetOwner",
        op: 0x7a0c6d21n,                // uint32 operation code we used in the contract
        newOwner: owner                 // gacha owns it after deploy
      }
    );
  });

  // give network a moment to finalize (also helps with “Max attempts”)
  await delay(3000);

  // 4) register this single item into tier 1 (or env TIER)
  const tier = BigInt(Number(process.env.TIER || "1"));
  const batch = packAddresses([item.address.toString()]);
  await withRetry(async () => {
    await gacha.send(
      provider.sender(),
      { value: toNano("0.06"), bounce: true },   // fee for admin add
      { $$type: "AdminAddItems", tier, items: batch }
    );
  });

  provider.ui().write("✅ Minted & registered 1 MockNftItem.");
  provider.ui().write(item.address.toString());
}
