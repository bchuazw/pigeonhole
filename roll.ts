import { toNano } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { GachaDispenser } from "../build/GachaDispenser/GachaDispenser_GachaDispenser";
import { Address } from "@ton/core";

export async function run(provider: NetworkProvider) {
  const gaddr = Address.parse(process.env.GACHA_ADDR!);
  provider.ui().write(`Rolling on: ${gaddr.toString()}`);
  const gacha = provider.open(GachaDispenser.fromAddress(gaddr));

  await gacha.send(provider.sender(), { value: toNano("0.05") }, { $$type: "Roll" });
  provider.ui().write("Roll tx sent (0.05 TON).");
}
