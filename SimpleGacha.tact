// Tact 1.6.13
import "@stdlib/ownable";

// top-level message (outside contract)
message Withdraw { to: Address; amount: Int; }   // amount = 0 => withdraw all

contract SimpleGacha with Ownable {
    // --- storage ---
    owner: Address;          // required by Ownable
    totalReceived: Int;

    // --- init ---
    init(owner: Address) {
        self.owner = owner;
        self.totalReceived = 0;
    }

    // Accept any TON (no payload needed)
    receive() {
        let ctx = context();
        self.totalReceived = self.totalReceived + ctx.value;
        // Funds remain until owner withdraws
    }

    // Owner withdraw
    receive(msg: Withdraw) {
        let ctx = context();
        require(ctx.sender == self.owner, "ONLY_OWNER");

        let bal = myBalance();
        let amt = (msg.amount == 0) ? bal : msg.amount;
        require(amt > 0, "ZERO");
        require(amt <= bal, "INSUFFICIENT");

        send(SendParameters{
            to: msg.to,
            value: amt,
            bounce: false
        });
    }

    // --- getters ---
    get fun getTotalReceived(): Int { 
        return self.totalReceived; 
    }
    get fun getBalance(): Int { 
        return myBalance(); 
    }
    get fun getOwner(): Address { 
        return self.owner; 
    }
}
