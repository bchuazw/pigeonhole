import { Address } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { GachaDispenser } from "../build/GachaDispenser/GachaDispenser_GachaDispenser";

export async function run(provider: NetworkProvider) {
  provider.ui().write(`Using gacha: ${process.env.GACHA_ADDR}`);
  const c = provider.open(GachaDispenser.fromAddress(Address.parse(process.env.GACHA_ADDR!)));
  const stock = await c.getGetStock();
  const price = await c.getGetPrice();
  provider.ui().write(`Stock (c1,c2,c3,c4): ${stock.c1}, ${stock.c2}, ${stock.c3}, ${stock.c4}`);
  provider.ui().write(`Price (nanoTON): ${price}`);
}
