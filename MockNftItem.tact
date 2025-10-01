// Tact 1.6.13 — minimal test NFT item
// - Holds `owner`, `controller`, `nonce`
// - Unique address via `nonce`
// - Accepts a typed SetOwner from controller
// - Has a no-op receive() so deploy messages are accepted

message SetOwner {
    op: Int as uint32 = 0x7a0c6d21;
    newOwner: Address;
}

contract MockNftItem {
    owner: Address;
    controller: Address;
    nonce: Int;

    init(controller: Address, nonce: Int) {
        self.controller = controller;
        self.owner = controller; // mint defaults owner = controller
        self.nonce = nonce;      // ensures unique address
    }

    // No-op handler to accept empty/internal deploy or stray messages
    receive() {
        // do nothing; accept funds/messages
    }

    // Only controller can set owner
    receive(msg: SetOwner) {
        require(context().sender == self.controller, "not controller");
        self.owner = msg.newOwner;
    }

    get fun getOwner(): Address { return self.owner; }
}
