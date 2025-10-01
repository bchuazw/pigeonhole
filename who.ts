import { Address } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { GachaDispenser } from "../build/GachaDispenser/GachaDispenser_GachaDispenser";

export async function run(provider: NetworkProvider) {
  const gachaAddr = Address.parse(process.env.GACHA_ADDR!);
  const c = provider.open(GachaDispenser.fromAddress(gachaAddr));
  const owner = await c.getGetOwner(); // we added this getter earlier; if you don't have it, I'll show the 1-line contract patch below
  provider.ui().write(`GACHA_ADDR: ${gachaAddr.toString()}`);
  provider.ui().write(`On-chain owner: ${owner.toString()}`);
  provider.ui().write(`Sender wallet: ${provider.sender().address?.toString()}`);
}
