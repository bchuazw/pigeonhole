// Tact 1.6.13 — ultra-thin MVP (hard-coded price/odds)
// Users send >= 0.05 TON with empty body (or call Roll{}) to roll.
// Contract picks tier (70/25/4/1) and transfers a preloaded TIP-4.1 item to the user.
import "@stdlib/ownable";

// ---------- Messages ----------
message Roll {}
message AdminAddItems { tier: Int; items: Cell; } // [uint16 count | addr * count]

// ---------- Structs ----------
struct PopResult {
    item: Address?; // optional because empty pool uses null
    ok:   Bool;
}

struct Stock {
    c1: Int;
    c2: Int;
    c3: Int;
    c4: Int;
}

// ---------- Contract ----------
contract GachaDispenser with Ownable {

    // Ownable requirement
    owner: Address;

    // --- state ---
    price: Int;   // nanoTON for a roll (hard-coded)
    seed:  Int;   // evolving seed for pseudo-randomness

    // 4 tier pools (address arrays via map index -> Address)
    pool1: map<Int, Address>; c1: Int;
    pool2: map<Int, Address>; c2: Int;
    pool3: map<Int, Address>; c3: Int;
    pool4: map<Int, Address>; c4: Int;

    init(owner: Address) {
        self.owner = owner;

        // price: 0.05 TON (1e9 nano per TON)
        self.price = 50_000_000;

        // simple non-zero seed
        self.seed = 1234567;

        // maps default empty; just zero the counters
        self.c1 = 0; self.c2 = 0; self.c3 = 0; self.c4 = 0;
    }

    // -------- helpers --------
    // pseudo-random 0..99 using evolving seed + sender
    fun rand100(sender: Address): Int {
        let mix = beginCell()
            .storeInt(self.seed, 64)
            .storeAddress(sender)
            .endCell()
            .hash();
        let r = (mix % 100 + 100) % 100;
        // evolve seed
        self.seed = (self.seed * 1103515245 + 12345) % 4294967297;
        return r;
    }

    // fixed odds: 70 / 25 / 4 / 1 (sum = 100)
    fun pickTier(r: Int): Int {
        let b1 = 70;
        let b2 = 95;  // 70 + 25
        let b3 = 99;  // 95 + 4
        if (r < b1) { return 1; }
        if (r < b2) { return 2; }
        if (r < b3) { return 3; }
        return 4;
    }

    // pop last item from a pool
    fun popFromPool(t: Int): PopResult {
        if (t == 1) {
            if (self.c1 <= 0) { return PopResult{ item: null, ok: false }; }
            let idx = self.c1 - 1;
            let a = self.pool1.get(idx);
            self.c1 = idx;
            return PopResult{ item: a, ok: true };
        }
        if (t == 2) {
            if (self.c2 <= 0) { return PopResult{ item: null, ok: false }; }
            let idx = self.c2 - 1;
            let a = self.pool2.get(idx);
            self.c2 = idx;
            return PopResult{ item: a, ok: true };
        }
        if (t == 3) {
            if (self.c3 <= 0) { return PopResult{ item: null, ok: false }; }
            let idx = self.c3 - 1;
            let a = self.pool3.get(idx);
            self.c3 = idx;
            return PopResult{ item: a, ok: true };
        }
        // t == 4
        if (self.c4 <= 0) { return PopResult{ item: null, ok: false }; }
        let idx = self.c4 - 1;
        let a = self.pool4.get(idx);
        self.c4 = idx;
        return PopResult{ item: a, ok: true };
    }

    // recursive helper to push N addresses from slice -> tier
    fun pushN(tier: Int, s: Slice, remaining: Int): Slice {
        if (remaining <= 0) { return s; }
        let a = s.loadAddress();
        if (tier == 1) {
            self.pool1.set(self.c1, a); self.c1 = self.c1 + 1;
        } else {
            if (tier == 2) {
                self.pool2.set(self.c2, a); self.c2 = self.c2 + 1;
            } else {
                if (tier == 3) {
                    self.pool3.set(self.c3, a); self.c3 = self.c3 + 1;
                } else {
                    self.pool4.set(self.c4, a); self.c4 = self.c4 + 1;
                }
            }
        }
        return self.pushN(tier, s, remaining - 1);
    }

    // push batch of addresses into a tier: items layout [uint16 count | addr * count]
    fun pushItems(tier: Int, items: Cell) {
        let s0 = items.beginParse();
        let n  = s0.loadUint(16);
        let _  = self.pushN(tier, s0, n);
    }

    // TIP-4.1 transfer to item address
    // send "SetOwner" to item (our minimal mock item protocol)
    fun sendNftTransfer(item: Address, newOwner: Address, responseDest: Address) {
        // Build body: [op: uint32=0x7a0c6d21 | newOwner: Address]
        let body = beginCell()
            .storeUint(0x7a0c6d21, 32)
            .storeAddress(newOwner)
            .endCell();

        // enough gas for the item to process a simple owner update
        send(SendParameters{
            to: item,
            value: 60_000_000, // 0.02 TON is plenty for this tiny handler
            bounce: false,
            body: body
        });
    }

    // -------- core roll logic (shared by both handlers) --------
    fun doRoll() {
        require(context().value >= self.price, "insufficient TON");

        let r = self.rand100(context().sender);
        let tier = self.pickTier(r);

        // try picked tier, then cascade 1->2->3->4
        let pr0 = self.popFromPool(tier);
        if (pr0.ok) {
            self.sendNftTransfer(pr0.item!!, context().sender, context().sender);
        } else {
            let pr1 = self.popFromPool(1);
            if (pr1.ok) {
                self.sendNftTransfer(pr1.item!!, context().sender, context().sender);
            } else {
                let pr2 = self.popFromPool(2);
                if (pr2.ok) {
                    self.sendNftTransfer(pr2.item!!, context().sender, context().sender);
                } else {
                    let pr3 = self.popFromPool(3);
                    if (pr3.ok) {
                        self.sendNftTransfer(pr3.item!!, context().sender, context().sender);
                    } else {
                        let pr4 = self.popFromPool(4);
                        require(pr4.ok, "out of stock");
                        self.sendNftTransfer(pr4.item!!, context().sender, context().sender);
                    }
                }
            }
        }

        // refund change
        let change = context().value - self.price;
        if (change > 0) {
            send(SendParameters{
                to: context().sender,
                value: change,
                bounce: false
            });
        }
    }

    // -------- user roll (explicit) --------
    receive(msg: Roll) {
        self.doRoll();
    }

    // -------- convenience: empty-body with enough TON also triggers Roll --------
    receive() {
        if (context().value >= self.price) {
            self.doRoll();
        }
    }

    // -------- admin: batch add items to a tier --------
    receive(msg: AdminAddItems) {
        //require(context().sender == self.owner, "not owner");
        require(msg.tier >= 1 && msg.tier <= 4, "bad tier");
        self.pushItems(msg.tier, msg.items);
    }

    // -------- getters (for UI/testing) --------
    get fun getStock(): Stock {
        return Stock{ c1: self.c1, c2: self.c2, c3: self.c3, c4: self.c4 };
    }

    get fun getPrice(): Int {
        return self.price;
    }

    get fun getOwner(): Address { return self.owner; }

}
