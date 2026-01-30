jkbvgjhbhjbjh
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * EtherTrialsTRIAv9 (Uniswap v3 via SwapRouter)
 * - Swap ETH -> TRIA menggunakan Uniswap V3 SwapRouter di Base
 * - Preset pool v3: fee 1% (10000) - adjustable by owner
 * - Tanpa import eksternal—siap paste di Remix
 * - Slippage on-chain: minOut=0 (sederhana). Untuk batas slippage gunakan off-chain.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract EtherTrialsTRIAv9 {
    /* ===== KONSTAN / ALAMAT (Base) ===== */
    address public constant TRIA_TOKEN        = 0xD852713dD8dDF61316DA19383D0c427aDb85EB07;
    address public constant SWAP_ROUTER       = 0x2626664c2603336E57B271c5C0b26F421741e481; // Uniswap V3 SwapRouter on Base
    address public constant WETH9             = 0x4200000000000000000000000000000000000006; // Base WETH

    /* ===== OWNER ===== */
    address public owner;

    /* ===== PARAM GAME ===== */
    uint256 public constant PERIOD_DURATION      = 24 hours;
    uint256 public constant REVEAL_WINDOW        = 20 minutes;
    uint256 public constant BASE_DICE_PRICE      = 0.00001 ether;
    uint256 public constant FREE_DICE_PER_PERIOD = 3;
    uint256 public constant MAX_PAID_ROLLS       = 60;
    uint256 public constant MAX_SCORE            = 1_000_000;

    uint256 public constant ENTRY_PRIZE_PERCENT    = 85;
    uint256 public constant ENTRY_BUYBACK_PERCENT  = 10;
    uint256 public constant ENTRY_TREASURY_PERCENT = 5;
    uint256 public constant DICE_BUYBACK_PERCENT   = 80;
    uint256 public constant DICE_TREASURY_PERCENT  = 20;

    uint256 public minEntry = 0.00001 ether;
    uint256 public maxEntry = 1 ether;

    /* ===== STATE ===== */
    uint256 public currentPeriod;
    uint256 public periodStartTime;

    struct PeriodInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 ethPrizePool;
        uint256 triaPrizePool;
        uint256 participants;
        uint256 totalPoints;
        bool allocated;
    }

    struct UserEntry {
        uint256 amount;
        uint256 entryTime;
        bool hasEntered;
    }

    struct DiceInfo {
        uint256 freeRollsUsed;
        uint256 paidRollsUsed;
    }

    struct ScoreCommit {
        bytes32 commitHash;
        uint256 commitTime;
        uint256 score;
        bool revealed;
    }

    mapping(uint256 => PeriodInfo) public periods;
    mapping(uint256 => mapping(address => UserEntry)) public userEntries;
    mapping(uint256 => mapping(address => DiceInfo)) public diceUsage;
    mapping(uint256 => mapping(address => ScoreCommit)) public scoreCommits;
    mapping(uint256 => mapping(address => uint256)) public userPoints;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(address => uint256[]) public userPeriods;

    uint256 public buybackTRIABalance;
    uint256 public treasuryBalance;
    uint256 public totalPrizeOwedTRIA;

    bool public paused;

    IERC20 public immutable triaToken = IERC20(TRIA_TOKEN);
    IWETH9 public immutable weth = IWETH9(WETH9);
    ISwapRouter public immutable swapRouter = ISwapRouter(SWAP_ROUTER);

    /* ===== POOL V3 PRESET (bisa diubah owner) ===== */
    // Default: fee 1% (10000)
    // V3 fee tiers: 500 (0.05%), 3000 (0.3%), 10000 (1%)
    uint24 public v3Fee = 10000;

    /* ===== EVENTS ===== */
    event PeriodStarted(uint256 indexed period, uint256 startTime);
    event EntryPaid(address indexed user, uint256 indexed period, uint256 amount);
    event DiceRolled(address indexed user, uint256 indexed period, bool isFree, uint256 price);
    event ScoreCommitted(address indexed user, uint256 indexed period, bytes32 commitHash);
    event ScoreRevealed(address indexed user, uint256 indexed period, uint256 score);
    event PrizesAllocated(uint256 indexed period, uint256 triaPrizePool, uint256 totalPoints);
    event RewardClaimed(address indexed user, uint256 indexed period, uint256 amount);
    event BuybackWithdrawn(address indexed owner, uint256 amount);
    event TreasuryWithdrawn(address indexed owner, uint256 amount);
    event Paused();
    event Unpaused();
    event EntryBoundsUpdated(uint256 minEntry, uint256 maxEntry);
    event V3FeeUpdated(uint24 fee);

    /* ===== REENTRANCY GUARD ===== */
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANT");
        _locked = 2;
        _;
        _locked = 1;
    }
    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }
    modifier whenNotPaused() { require(!paused, "Paused"); _; }

    constructor() {
        owner = msg.sender;
        currentPeriod = 1;
        periodStartTime = block.timestamp;
        periods[1].startTime = block.timestamp;
        periods[1].endTime   = block.timestamp + PERIOD_DURATION;
        emit PeriodStarted(1, block.timestamp);
    }

    /* ===== ADMIN ===== */
    function setEntryBounds(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin > 0 && newMax >= newMin, "Invalid bounds");
        minEntry = newMin;
        maxEntry = newMax;
        emit EntryBoundsUpdated(newMin, newMax);
    }

    function setV3Fee(uint24 fee) external onlyOwner {
        require(fee == 500 || fee == 3000 || fee == 10000, "Invalid fee tier");
        v3Fee = fee;
        emit V3FeeUpdated(fee);
    }

    function pause() external onlyOwner { paused = true; emit Paused(); }
    function unpause() external onlyOwner { paused = false; emit Unpaused(); }

    /* ===== ENTRY ===== */
    function enterTournament() external payable whenNotPaused {
        require(msg.value >= minEntry && msg.value <= maxEntry, "Invalid entry");
        require(block.timestamp < periods[currentPeriod].endTime, "Period ended");
        require(!userEntries[currentPeriod][msg.sender].hasEntered, "Already entered");

        uint256 toPrize   = (msg.value * ENTRY_PRIZE_PERCENT) / 100;
        uint256 toBuyback = (msg.value * ENTRY_BUYBACK_PERCENT) / 100;
        uint256 toTreas   = msg.value - toPrize - toBuyback;

        periods[currentPeriod].ethPrizePool += toPrize;
        periods[currentPeriod].participants++;
        treasuryBalance += toTreas;

        if (toBuyback > 0) _buybackTRIA(toBuyback);

        userEntries[currentPeriod][msg.sender] =
            UserEntry({amount: msg.value, entryTime: block.timestamp, hasEntered: true});
        userPeriods[msg.sender].push(currentPeriod);
        emit EntryPaid(msg.sender, currentPeriod, msg.value);
    }

    /* ===== DICE ===== */
    function rollDice() external payable whenNotPaused {
        require(userEntries[currentPeriod][msg.sender].hasEntered, "Enter first");
        require(block.timestamp < periods[currentPeriod].endTime, "Period ended");
        DiceInfo storage d = diceUsage[currentPeriod][msg.sender];

        if (d.freeRollsUsed < FREE_DICE_PER_PERIOD) {
            require(msg.value == 0, "Free = 0");
            d.freeRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, true, 0);
        } else {
            require(d.paidRollsUsed < MAX_PAID_ROLLS, "Max paid rolls");
            uint256 expected = BASE_DICE_PRICE * (1 << d.paidRollsUsed);
            require(msg.value == expected, "Wrong price");
            uint256 toBuyback = (msg.value * DICE_BUYBACK_PERCENT) / 100;
            uint256 toTreas   = msg.value - toBuyback;
            treasuryBalance += toTreas;
            if (toBuyback > 0) _buybackTRIA(toBuyback);
            d.paidRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, false, msg.value);
        }
    }

    /* ===== SCORE ===== */
    function commitScore(bytes32 commitHash) external whenNotPaused {
        require(userEntries[currentPeriod][msg.sender].hasEntered, "Enter first");
        require(block.timestamp < periods[currentPeriod].endTime, "Period ended");
        require(scoreCommits[currentPeriod][msg.sender].commitHash == bytes32(0), "Committed");
        scoreCommits[currentPeriod][msg.sender] =
            ScoreCommit({commitHash: commitHash, commitTime: block.timestamp, score: 0, revealed: false});
        emit ScoreCommitted(msg.sender, currentPeriod, commitHash);
    }

    function revealScore(uint256 score, uint256 nonce) external whenNotPaused {
        ScoreCommit storage c = scoreCommits[currentPeriod][msg.sender];
        require(c.commitHash != bytes32(0), "No commit");
        require(!c.revealed, "Revealed");
        require(block.timestamp <= c.commitTime + REVEAL_WINDOW, "Expired");
        require(score <= MAX_SCORE, "Too high");
        bytes32 expected = keccak256(abi.encodePacked(score, nonce, msg.sender));
        require(c.commitHash == expected, "Invalid reveal");
        c.score = score; c.revealed = true;
        userPoints[currentPeriod][msg.sender] = score;
        periods[currentPeriod].totalPoints += score;
        emit ScoreRevealed(msg.sender, currentPeriod, score);
    }

    /* ===== ALOKASI HADIAH ===== */
    function allocatePrizes(uint256 period) external whenNotPaused {
        PeriodInfo storage p = periods[period];
        require(block.timestamp >= p.endTime + REVEAL_WINDOW, "Wait");
        require(!p.allocated, "Allocated");
        require(p.totalPoints > 0, "No points");

        uint256 ethToSwap = p.ethPrizePool;
        if (ethToSwap > 0) {
            uint256 before = triaToken.balanceOf(address(this));
            _swapETHtoTRIA_V3(ethToSwap);
            uint256 got = triaToken.balanceOf(address(this)) - before;
            p.triaPrizePool += got;
            totalPrizeOwedTRIA += got;
            p.ethPrizePool = 0;
        }

        p.allocated = true;
        emit PrizesAllocated(period, p.triaPrizePool, p.totalPoints);
    }

    /* ===== CLAIM ===== */
    function claimReward(uint256 period) public nonReentrant whenNotPaused {
        PeriodInfo storage p = periods[period];
        require(p.allocated, "Not allocated");
        require(!claimed[period][msg.sender], "Claimed");
        uint256 pts = userPoints[period][msg.sender];
        require(pts > 0, "No points");
        uint256 amount = (p.triaPrizePool * pts) / p.totalPoints;
        require(amount > 0, "Nothing");
        claimed[period][msg.sender] = true;
        totalPrizeOwedTRIA -= amount;
        require(triaToken.transfer(msg.sender, amount), "Transfer fail");
        emit RewardClaimed(msg.sender, period, amount);
    }

    function claimRewards(uint256[] calldata pids) external {
        for (uint i = 0; i < pids.length; i++) claimReward(pids[i]);
    }

    /* ===== PERIOD MGMT ===== */
    function startNewPeriod() external onlyOwner whenNotPaused {
        require(block.timestamp >= periods[currentPeriod].endTime, "Not ended");
        require(periods[currentPeriod].allocated, "Allocate first");
        currentPeriod++;
        periods[currentPeriod].startTime = block.timestamp;
        periods[currentPeriod].endTime   = block.timestamp + PERIOD_DURATION;
        emit PeriodStarted(currentPeriod, block.timestamp);
    }

    /* ===== WITHDRAW ===== */
    function withdrawBuyback() external onlyOwner nonReentrant {
        uint256 bal = triaToken.balanceOf(address(this));
        require(bal >= totalPrizeOwedTRIA, "Prize shortfall");
        uint256 free = bal - totalPrizeOwedTRIA;
        uint256 amt  = buybackTRIABalance;
        require(amt > 0 && amt <= free, "Invalid");
        buybackTRIABalance = 0;
        require(triaToken.transfer(owner, amt), "Transfer fail");
        emit BuybackWithdrawn(owner, amt);
    }

    function withdrawTreasury() external onlyOwner nonReentrant {
        uint256 amt = treasuryBalance;
        require(amt > 0, "No treasury");
        treasuryBalance = 0;
        (bool ok,) = payable(owner).call{value: amt}("");
        require(ok, "Fail");
        emit TreasuryWithdrawn(owner, amt);
    }

    /* ===== INTERNAL SWAP (V3) ===== */

    function _buybackTRIA(uint256 ethAmt) internal {
        uint256 before = triaToken.balanceOf(address(this));
        _swapETHtoTRIA_V3(ethAmt);
        uint256 got = triaToken.balanceOf(address(this)) - before;
        buybackTRIABalance += got;
    }

    /**
     * Swap ETH -> TRIA via Uniswap V3 SwapRouter.
     * 1. Wrap ETH to WETH
     * 2. Approve WETH to SwapRouter
     * 3. Call exactInputSingle
     */
    function _swapETHtoTRIA_V3(uint256 ethAmt) internal {
        // 1. Wrap ETH to WETH
        weth.deposit{value: ethAmt}();
        
        // 2. Approve SwapRouter to spend WETH
        weth.approve(address(swapRouter), ethAmt);
        
        // 3. Swap WETH -> TRIA
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH9,
            tokenOut: TRIA_TOKEN,
            fee: v3Fee,                      // default 10000 (1%)
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: ethAmt,
            amountOutMinimum: 0,             // slippage guard off-chain
            sqrtPriceLimitX96: 0             // no price limit
        });
        
        swapRouter.exactInputSingle(params);
    }

    receive() external payable {}
}
