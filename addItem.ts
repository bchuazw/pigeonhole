import { Address, beginCell, toNano } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { GachaDispenser } from "../build/GachaDispenser/GachaDispenser_GachaDispenser";

function packOneAddress(addr: string) {
  const b = beginCell();
  b.storeUint(1, 16);                     // count = 1
  b.storeAddress(Address.parse(addr));    // the single address
  return b.endCell();
}

export async function run(provider: NetworkProvider) {
  const gaddr = Address.parse(process.env.GACHA_ADDR!);
  provider.ui().write(`Using gacha: ${gaddr.toString()}`);
  const gacha = provider.open(GachaDispenser.fromAddress(gaddr));

  const tier = BigInt(Number(process.env.TIER || "1"));
  const item = process.env.ITEM!;
  const itemsCell = packOneAddress(item);

  await gacha.send(
    provider.sender(),
    { value: toNano("0.03") },
    { $$type: "AdminAddItems", tier, items: itemsCell }
  );

  provider.ui().write(`Added item ${item} to tier ${tier}`);
}
