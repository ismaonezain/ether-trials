// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * EtherTrialsTRIAv10 (Mainnet-ready, constructor-injected)
 * 
 * PRIZE DISTRIBUTION: 100% POINT-BASED, NO LIMITS
 * - Points = score × (totalModal / 1e18)
 * - Prize = (triaPrizePool × userPoints) / totalPoints
 * - NO point cap, NO ticket system, PURE proportional distribution
 * 
 * ENTRY FLOW:
 * - ETH entry → swap to TRIA via Uniswap V3 SwapRouter (exactInputSingle)
 * - Split: 80% prize pool + 20% platform fees (in TRIA)
 * 
 * SCORING:
 * - MAX_SCORE = 2_000_000
 * - Higher score + higher modal = more points = bigger prize share
 * 
 * NOTE: amountOutMinimum currently set to 0 (no slippage guard).
 *       For production mainnet, set amountOutMinimum via frontend/quoter.
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

contract EtherTrialsTRIAv10 {
    /* ===== ADDRESSES (injected for mainnet) ===== */
    address public immutable TRIA_TOKEN;
    address public immutable SWAP_ROUTER;
    address public immutable WETH9;

    /* ===== OWNER ===== */
    address public owner;

    /* ===== GAME CONSTANTS ===== */
    uint256 public constant PERIOD_DURATION      = 24 hours;
    uint256 public constant REVEAL_WINDOW        = 20 minutes;
    uint256 public constant BASE_DICE_PRICE      = 0.00001 ether;
    uint256 public constant FREE_DICE_PER_PERIOD = 3;
    uint256 public constant MAX_PAID_ROLLS       = 60;
    uint256 public constant MAX_SCORE            = 2_000_000;

    /* ===== SPLIT ===== */
    uint256 public constant ENTRY_PRIZE_PERCENT    = 80;  // 80% to prize pool
    uint256 public constant ENTRY_PLATFORM_PERCENT = 20;  // 20% platform fees
    uint256 public constant DICE_PRIZE_PERCENT     = 80;
    uint256 public constant DICE_PLATFORM_PERCENT  = 20;

    // SCALE for normalization (WEI)
    uint256 public constant WEI_SCALE = 1e18;

    // default minEntry set per your request
    uint256 public minEntry = 0.00002 ether; // <-- 0.00002 ETH
    uint256 public maxEntry = 1 ether;

    /* ===== STATE ===== */
    uint256 public currentPeriod;
    uint256 public periodStartTime;

    struct PeriodInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 triaPrizePool;   // Prize pool in TRIA
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

    // total modal per user per period (WEI)
    mapping(uint256 => mapping(address => uint256)) public userTotalModal;

    uint256 public platformFeesBalance;      // TRIA
    uint256 public totalPrizeOwedTRIA;       // TRIA

    bool public paused;

    IERC20 public immutable triaToken;
    IWETH9 public immutable weth;
    ISwapRouter public immutable swapRouter;

    // Uniswap v3 fee tier default (owner can change)
    uint24 public v3Fee = 3000;

    /* ===== EVENTS ===== */
    event PeriodStarted(uint256 indexed period, uint256 startTime);
    event EntryPaid(address indexed user, uint256 indexed period, uint256 ethAmount, uint256 triaReceived);
    event DiceRolled(address indexed user, uint256 indexed period, bool isFree, uint256 price);
    event ScoreCommitted(address indexed user, uint256 indexed period, bytes32 commitHash);
    event ScoreRevealed(address indexed user, uint256 indexed period, uint256 score);
    event PrizesAllocated(uint256 indexed period, uint256 triaPrizePool, uint256 totalPoints);
    event RewardClaimed(address indexed user, uint256 indexed period, uint256 amount);
    event PlatformFeesWithdrawn(address indexed owner, uint256 amount);
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

    constructor(address triaAddr, address swapRouterAddr, address wethAddr) {
        require(triaAddr != address(0) && swapRouterAddr != address(0) && wethAddr != address(0), "Zero address");
        TRIA_TOKEN = triaAddr;
        SWAP_ROUTER = swapRouterAddr;
        WETH9 = wethAddr;

        owner = msg.sender;
        triaToken = IERC20(triaAddr);
        weth = IWETH9(wethAddr);
        swapRouter = ISwapRouter(swapRouterAddr);

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
    function enterTournament() external payable whenNotPaused nonReentrant {
        require(msg.value >= minEntry && msg.value <= maxEntry, "Invalid entry");
        require(block.timestamp < periods[currentPeriod].endTime, "Period ended");
        require(!userEntries[currentPeriod][msg.sender].hasEntered, "Already entered");

        // Swap ETH -> TRIA
        uint256 triaReceived = _swapETHtoTRIA(msg.value);
        require(triaReceived > 0, "Swap failed");

        uint256 toPrize = (triaReceived * ENTRY_PRIZE_PERCENT) / 100;
        uint256 toPlatform = triaReceived - toPrize;

        periods[currentPeriod].triaPrizePool += toPrize;
        periods[currentPeriod].participants++;
        platformFeesBalance += toPlatform;
        totalPrizeOwedTRIA += toPrize;

        userEntries[currentPeriod][msg.sender] =
            UserEntry({amount: msg.value, entryTime: block.timestamp, hasEntered: true});
        userPeriods[msg.sender].push(currentPeriod);

        userTotalModal[currentPeriod][msg.sender] += msg.value;

        emit EntryPaid(msg.sender, currentPeriod, msg.value, triaReceived);
    }

    /* ===== DICE (unchanged) ===== */
    function rollDice() external payable whenNotPaused nonReentrant {
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

            uint256 triaReceived = _swapETHtoTRIA(msg.value);
            require(triaReceived > 0, "Swap failed");

            uint256 toPrize = (triaReceived * DICE_PRIZE_PERCENT) / 100;
            uint256 toPlatform = triaReceived - toPrize;

            periods[currentPeriod].triaPrizePool += toPrize;
            platformFeesBalance += toPlatform;
            totalPrizeOwedTRIA += toPrize;

            d.paidRollsUsed++;
            userTotalModal[currentPeriod][msg.sender] += msg.value;

            emit DiceRolled(msg.sender, currentPeriod, false, msg.value);
        }
    }

    /* ===== COMMIT-REVEAL SCORE ===== */
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

        uint256 modal = userTotalModal[currentPeriod][msg.sender];
        require(modal > 0, "No modal");

        uint256 points = (score * modal) / WEI_SCALE;

        userPoints[currentPeriod][msg.sender] = points;
        periods[currentPeriod].totalPoints += points;
        emit ScoreRevealed(msg.sender, currentPeriod, score);
    }

    /* ===== PRIZE ALLOCATION & CLAIM (unchanged) ===== */
    function allocatePrizes(uint256 period) external whenNotPaused {
        PeriodInfo storage p = periods[period];
        require(block.timestamp >= p.endTime + REVEAL_WINDOW, "Wait");
        require(!p.allocated, "Allocated");
        require(p.totalPoints > 0, "No points");
        p.allocated = true;
        emit PrizesAllocated(period, p.triaPrizePool, p.totalPoints);
    }

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

    /* ===== PERIOD MANAGEMENT & OWNER WITHDRAW ===== */
    function startNewPeriod() external onlyOwner whenNotPaused {
        require(block.timestamp >= periods[currentPeriod].endTime, "Not ended");
        require(periods[currentPeriod].allocated, "Allocate first");
        currentPeriod++;
        periods[currentPeriod].startTime = block.timestamp;
        periods[currentPeriod].endTime   = block.timestamp + PERIOD_DURATION;
        emit PeriodStarted(currentPeriod, block.timestamp);
    }

    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 bal = triaToken.balanceOf(address(this));
        require(bal >= totalPrizeOwedTRIA, "Prize shortfall");
        uint256 available = bal - totalPrizeOwedTRIA;
        uint256 amt = platformFeesBalance;
        require(amt > 0 && amt <= available, "Invalid");
        platformFeesBalance = 0;
        require(triaToken.transfer(owner, amt), "Transfer fail");
        emit PlatformFeesWithdrawn(owner, amt);
    }

    /* ===== INTERNAL SWAP ===== */
    function _swapETHtoTRIA(uint256 ethAmt) internal returns (uint256) {
        // 1. Wrap ETH to WETH
        weth.deposit{value: ethAmt}();

        // 2. Approve SwapRouter to spend WETH
        weth.approve(address(swapRouter), ethAmt);

        // 3. Swap WETH -> TRIA
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH9,
            tokenOut: TRIA_TOKEN,
            fee: v3Fee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: ethAmt,
            amountOutMinimum: 0,         // WARNING: on mainnet set via frontend/quoter
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);
        return amountOut;
    }

    receive() external payable {}
}
