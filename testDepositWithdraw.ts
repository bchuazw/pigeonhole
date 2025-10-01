// scripts/testDepositWithdraw.ts
import "dotenv/config";
import { Address, toNano } from "@ton/core";
import { NetworkProvider } from "@ton/blueprint";
import { SimpleGacha } from "../build/SimpleGacha/SimpleGacha_SimpleGacha";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ---- Global RPC rate limiter: 1 call / 2s ---- */
class RateLimiter {
  private last = 0;
  constructor(private minIntervalMs: number) {}
  async wait() {
    const now = Date.now();
    const elapsed = now - this.last;
    const waitFor = this.minIntervalMs - elapsed;
    if (waitFor > 0) await sleep(waitFor);
    this.last = Date.now();
  }
}
const limiter = new RateLimiter(2000); // 2 seconds

/** Call any async fn with limiter + retries + backoff */
async function callRpc<T>(
  label: string,
  fn: () => Promise<T>,
  tries = 8,
  startDelayMs = 2000,   // base delay
  backoff = 1.5          // exponential backoff
): Promise<T> {
  let delay = startDelayMs;
  let lastErr: any;
  for (let i = 1; i <= tries; i++) {
    try {
      await limiter.wait();
      const res = await fn();
      return res;
    } catch (err) {
      lastErr = err;
      const msg = (err as any)?.message || String(err);
      console.log(`⚠️  ${label} attempt ${i}/${tries} failed: ${msg}`);
      if (i < tries) {
        console.log(`   ⏳ sleeping ${Math.round(delay / 1000)}s then retrying...`);
        await sleep(delay);
        delay = Math.min(delay * backoff, 20000);
      }
    }
  }
  throw lastErr;
}

function links(address: string) {
  return {
    tonviewer: `https://testnet.tonviewer.com/${address}`,
    tonscan: `https://testnet.tonscan.org/address/${address}`,
  };
}

export async function run(provider: NetworkProvider) {
  const ownerStr = process.env.OWNER?.trim();
  const contractStr = process.env.CONTRACT?.trim();
  if (!ownerStr) throw new Error("Missing OWNER in .env");
  if (!contractStr) throw new Error("Missing CONTRACT in .env");

  const owner = Address.parse(ownerStr);
  const contractAddr = Address.parse(contractStr);
  const contract = provider.open(SimpleGacha.fromAddress(contractAddr));

  console.log("== SimpleGacha Test: Deposit -> Wait -> Withdraw ==");
  console.log("Contract:", contractAddr.toString());
  console.log("Owner   :", owner.toString());
  console.log("Explorer (contract):", links(contractAddr.toString()));
  console.log("Explorer (owner)   :", links(owner.toString()));
  console.log("");

  // Optional initial reads (throttled)
  try {
    const [bal0, tot0] = await Promise.all([
      callRpc("getGetBalance()", () => contract.getGetBalance()),
      callRpc("getGetTotalReceived()", () => contract.getGetTotalReceived()),
    ]);
    console.log("ℹ️  Start balance (nanoTON):", bal0.toString());
    console.log("ℹ️  Start totalReceived (nanoTON):", tot0.toString());
  } catch {
    console.log("ℹ️  Skipped initial on-chain reads.");
  }

  // 1) DEPOSIT 0.01 TON (from Owner)
  const depositTon = "0.01";
  const deposit = toNano(depositTon);
  console.log(`➡️  Sending deposit of ${depositTon} TON to contract...`);
  await callRpc("deposit send", () =>
    provider.sender().send({ to: contractAddr, value: deposit })
  );
  console.log("✅ Deposit sent. Waiting ~15s for network finality...");
  await sleep(15000);

  try {
    const [bal1, tot1] = await Promise.all([
      callRpc("getGetBalance()", () => contract.getGetBalance()),
      callRpc("getGetTotalReceived()", () => contract.getGetTotalReceived()),
    ]);
    console.log("ℹ️  Balance after deposit (nanoTON):", bal1.toString());
    console.log("ℹ️  TotalReceived after deposit (nanoTON):", tot1.toString());
  } catch {}
  console.log("🔗 Contract explorer:", links(contractAddr.toString()));

  // Extra delay before withdraw so wallet seqno surely increments
  console.log("\n⏳ Waiting an extra 10s before withdraw to avoid seqno race...");
  await sleep(10000);

    // --- before withdraw: read current balance and compute safe amount ---
    const reserve = toNano("0.02"); // keep some nanoTON for fees/rent
    const balNow = await callRpc("getGetBalance()", () => contract.getGetBalance());
    const safeAmt = balNow > reserve ? (balNow - reserve) : 0n;
    console.log(`\n➡️  Preparing withdraw. Contract balance: ${balNow.toString()} nanoTON`);
    console.log(`   Reserve kept: ${reserve.toString()} nanoTON`);
    console.log(`   Will withdraw: ${safeAmt.toString()} nanoTON`);

    if (safeAmt === 0n) {
    console.log("⚠️  Nothing safe to withdraw right now; skipping.");
    } else {
    console.log("➡️  Sending Withdraw(safeAmt) to Owner...");
    await callRpc("withdraw send", () =>
        contract.send(
        provider.sender(),
        { value: toNano("0.05") }, // fee buffer for the inbound control message
        { $$type: "Withdraw", to: owner, amount: safeAmt }
        )
    );
    console.log("✅ Withdraw message sent. Waiting ~15s for network finality...");
    await sleep(15000);
    }

  try {
    const [bal2, tot2] = await Promise.all([
      callRpc("getGetBalance()", () => contract.getGetBalance()),
      callRpc("getGetTotalReceived()", () => contract.getGetTotalReceived()),
    ]);
    console.log("ℹ️  Balance after withdraw (nanoTON):", bal2.toString());
    console.log("ℹ️  TotalReceived after withdraw (nanoTON):", tot2.toString());
  } catch {}

  console.log("\n🎉 Test completed.");
  console.log("🔗 Contract activity:", links(contractAddr.toString()));
  console.log("🔗 Owner wallet activity:", links(owner.toString()));
}
