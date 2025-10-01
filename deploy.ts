import { Address, toNano } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { GachaDispenser } from "../build/GachaDispenser/GachaDispenser_GachaDispenser";

export async function run(provider: NetworkProvider) {
  const owner = Address.parse(process.env.OWNER!);

  // Build the contract with its init data
  const contract = await GachaDispenser.fromInit(owner);

  // Send a message that includes the init (this deploys the contract)
  await provider.sender().send({
    to: contract.address,
    value: toNano("0.05"),  // deployment gas
    init: contract.init,    // <-- critical: pass code+data for deployment
  });

  // You can open it afterwards if you want to call getters or methods
  const gacha = provider.open(contract);
  provider.ui().write(`Deployed at: ${gacha.address.toString()}`);
}
