import { Address } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { MockNftItem } from "../build/MockNftItem/MockNftItem_MockNftItem";

export async function run(provider: NetworkProvider) {
  const item = Address.parse((process.env.ITEM || '').trim().replace(/^['"]|['"]$/g, ''));
  const c = provider.open(MockNftItem.fromAddress(item));
  const owner = await c.getGetOwner();
  provider.ui().write(`Item: ${item.toString()}`);
  provider.ui().write(`Owner: ${owner.toString()}`);
}
