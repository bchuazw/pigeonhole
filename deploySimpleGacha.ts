// scripts/deploySimpleGacha.ts
import "dotenv/config";
import { Address, toNano } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { SimpleGacha } from "../build/SimpleGacha/SimpleGacha_SimpleGacha";

export async function run(provider: NetworkProvider) {
  const ownerStr = process.env.OWNER?.trim();
  if (!ownerStr) throw new Error("OWNER env is missing");

  // Parse testnet-friendly address (copy the one blueprint shows)
  const owner = Address.parse(ownerStr);             // or: Address.parseFriendly(ownerStr).address

  const c = provider.open(await SimpleGacha.fromInit(owner));

  // first message with some value deploys the contract (null body hits default receive)
  await c.send(provider.sender(), { value: toNano("0.05") }, null);

  console.log("✅ Deployed SimpleGacha at:", c.address.toString());
}
