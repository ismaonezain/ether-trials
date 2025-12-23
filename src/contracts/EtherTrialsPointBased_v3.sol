// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * EtherTrialsPointBased_v3
 * - ENTRY_FEE fixed 0.00002 ETH (payEntryFee payable)
 * - ETH entry swapped to TRIA via Uniswap V3 SwapRouter
 * - Frontend provides amountOutMinimum (slippage guard)
 * - Points = score (pure score, no modal influence)
 * - Owner submits scores; allocation based on points proportion
 * - Payouts in TRIA token
 *
 * Constructor-injected addresses (tria, swapRouter, weth) for mainnet deploy.
 *
 * WARNING: frontend MUST compute amountOutMinimum using Uniswap Quoter or off-chain oracle;
 *          passing 0 disables slippage protection.
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

contract EtherTrialsPointBased_v3 {
    address public owner;

    // Entry fee fixed
    uint256 public constant ENTRY_FEE = 0.00002 ether;
    uint256 public constant MAX_SCORE = 2_000_000;

    uint256 public constant DISTRIBUTION_INTERVAL = 24 hours;

    // Split for TRIA after swap
    uint256 public constant PRIZE_PERCENT = 80;   // 80% to prize pool
    uint256 public constant PLATFORM_PERCENT = 20; // 20% to platform

    // injected addresses
    address public immutable TRIA_TOKEN;
    address public immutable SWAP_ROUTER;
    address public immutable WETH9;

    // Uniswap v3 fee tier (owner adjustable)
    uint24 public v3Fee = 3000;

    // period bookkeeping
    uint256 public currentPeriod;
    uint256 public lastDistributionTime;

    struct Period {
        uint256 prizePoolTRIA; // total prize pool for period (in TRIA)
        uint256 totalPoints;   // sum of points (now pure score)
        uint256 participantCount;
        uint256 startTime;
        uint256 endTime;
        bool distributed;
    }

    struct Player {
        uint256 score;
        uint256 pendingPrizeTRIA;
        bool claimed;
        bool hasEntered;
    }

    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(address => Player)) public playerData;
    mapping(uint256 => address[]) public periodPlayers;

    // user points per period (now equal to score)
    mapping(uint256 => mapping(address => uint256)) public userPoints;

    // platform fees and prize accounting (in TRIA)
    uint256 public platformFeesTRIA;
    uint256 public totalPrizeOwedTRIA;

    // interfaces
    IERC20 public immutable triaToken;
    IWETH9 public immutable weth;
    ISwapRouter public immutable swapRouter;

    // simple reentrancy guard
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANT");
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotDistributed(uint256 period) {
        require(!periods[period].distributed, "Period already distributed");
        _;
    }

    event EntryFeePaid(address indexed player, uint256 ethAmount, uint256 triaReceived, uint256 period, uint256 timestamp);
    event ScoreSubmitted(address indexed player, uint256 score, uint256 period, uint256 timestamp);
    event PrizesAllocated(uint256 period, uint256 prizePoolTRIA, uint256 totalPoints, uint256 participantCount, uint256 timestamp);
    event PrizeClaimed(address indexed player, uint256 period, uint256 amountTRIA, uint256 timestamp);
    event PlatformFeesWithdrawn(address indexed owner, uint256 amountTRIA, uint256 timestamp);
    event PeriodStarted(uint256 period, uint256 startTime, uint256 endTime);

    constructor(address triaAddr, address swapRouterAddr, address wethAddr) {
        require(triaAddr != address(0) && swapRouterAddr != address(0) && wethAddr != address(0), "Zero address");
        owner = msg.sender;

        TRIA_TOKEN = triaAddr;
        SWAP_ROUTER = swapRouterAddr;
        WETH9 = wethAddr;

        triaToken = IERC20(triaAddr);
        swapRouter = ISwapRouter(swapRouterAddr);
        weth = IWETH9(wethAddr);

        currentPeriod = 1;
        lastDistributionTime = block.timestamp;
        periods[currentPeriod] = Period({
            prizePoolTRIA: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + DISTRIBUTION_INTERVAL,
            distributed: false
        });
        emit PeriodStarted(currentPeriod, block.timestamp, periods[currentPeriod].endTime);
    }

    // ========== ENTRY (fixed fee) ==========
    // amountOutMinimum: slippage guard provided by frontend (in TRIA units, wei)
    function payEntryFee(uint256 amountOutMinimum) external payable nonReentrant {
        require(msg.value == ENTRY_FEE, "Incorrect entry fee");
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        require(!playerData[currentPeriod][msg.sender].hasEntered, "Already entered");

        // swap ETH->TRIA, then split 80/20, using frontend-provided slippage guard
        uint256 triaReceived = _swapETHtoTRIA(msg.value, amountOutMinimum);
        require(triaReceived > 0, "Swap failed");

        uint256 toPrize = (triaReceived * PRIZE_PERCENT) / 100;
        uint256 toPlatform = triaReceived - toPrize;

        // credit prize pool for current period (TRIA)
        p.prizePoolTRIA += toPrize;
        platformFeesTRIA += toPlatform;
        totalPrizeOwedTRIA += toPrize;

        // record user entry
        playerData[currentPeriod][msg.sender].hasEntered = true;
        periodPlayers[currentPeriod].push(msg.sender);
        p.participantCount += 1;

        emit EntryFeePaid(msg.sender, msg.value, triaReceived, currentPeriod, block.timestamp);
    }

    // ========== OWNER SUBMIT SCORE ==========
    // Now points = score (pure score). Owner must submit scores.
    function submitScore(address player, uint256 score) external onlyOwner whenNotDistributed(currentPeriod) {
        require(playerData[currentPeriod][player].hasEntered, "Player not entered");
        require(score <= MAX_SCORE, "Score too high");

        uint256 oldPoints = userPoints[currentPeriod][player];
        if (oldPoints > 0) {
            periods[currentPeriod].totalPoints -= oldPoints;
        }

        // set score and points = score
        playerData[currentPeriod][player].score = score;
        userPoints[currentPeriod][player] = score;
        if (score > 0) {
            periods[currentPeriod].totalPoints += score;
        }

        emit ScoreSubmitted(player, score, currentPeriod, block.timestamp);
    }

    // batch submit scores
    function submitScoresBatch(address[] calldata players, uint256[] calldata scores) external onlyOwner whenNotDistributed(currentPeriod) {
        require(players.length == scores.length, "Arrays length mismatch");
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint256 score = scores[i];
            if (playerData[currentPeriod][player].hasEntered && score <= MAX_SCORE) {
                uint256 oldPoints = userPoints[currentPeriod][player];
                if (oldPoints > 0) periods[currentPeriod].totalPoints -= oldPoints;
                playerData[currentPeriod][player].score = score;
                userPoints[currentPeriod][player] = score;
                if (score > 0) periods[currentPeriod].totalPoints += score;
                emit ScoreSubmitted(player, score, currentPeriod, block.timestamp);
            }
        }
    }

    // ========== ALLOCATE PRIZES (owner) ==========
    function allocatePrizes() external onlyOwner nonReentrant {
        Period storage p = periods[currentPeriod];
        require(block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL, "Distribution interval not reached");
        require(!p.distributed, "Already distributed");
        require(p.prizePoolTRIA > 0, "No prize pool");
        require(p.totalPoints > 0, "No points submitted");

        uint256 poolToDistribute = p.prizePoolTRIA;
        uint256 totalPoints = p.totalPoints;
        address[] memory players = periodPlayers[currentPeriod];
        uint256 allocatedTotal = 0;

        for (uint256 i = 0; i < players.length; i++) {
            address pl = players[i];
            uint256 pts = userPoints[currentPeriod][pl];
            if (pts == 0) continue;
            uint256 prize = (pts * poolToDistribute) / totalPoints;
            if (prize > 0) {
                playerData[currentPeriod][pl].pendingPrizeTRIA = prize;
                allocatedTotal += prize;
            }
        }

        // mark distributed and set period metadata
        p.distributed = true;

        emit PrizesAllocated(currentPeriod, poolToDistribute, totalPoints, p.participantCount, block.timestamp);

        // reset accounting for next period
        // reduce totalPrizeOwedTRIA by allocatedTotal
        if (allocatedTotal > totalPrizeOwedTRIA) {
            // defensive: should not normally happen, but avoid underflow
            totalPrizeOwedTRIA = 0;
        } else {
            totalPrizeOwedTRIA -= allocatedTotal;
        }

        lastDistributionTime = block.timestamp;
        currentPeriod++;
        periods[currentPeriod] = Period({
            prizePoolTRIA: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + DISTRIBUTION_INTERVAL,
            distributed: false
        });
        emit PeriodStarted(currentPeriod, block.timestamp, periods[currentPeriod].endTime);
    }

    // ========== CLAIM (players claim TRIA) ==========
    function claimPrize(uint256 period) external nonReentrant {
        require(periods[period].distributed, "Period not distributed");
        Player storage ps = playerData[period][msg.sender];
        require(!ps.claimed, "Already claimed");
        uint256 amount = ps.pendingPrizeTRIA;
        require(amount > 0, "No prize");

        ps.claimed = true;
        ps.pendingPrizeTRIA = 0;

        require(triaToken.transfer(msg.sender, amount), "TRIA transfer failed");
        emit PrizeClaimed(msg.sender, period, amount, block.timestamp);
    }

    // ========== OWNER withdraw platform fees (TRIA) ==========
    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 amt = platformFeesTRIA;
        require(amt > 0, "No fees");
        platformFeesTRIA = 0;
        require(triaToken.transfer(owner, amt), "TRIA transfer failed");
        emit PlatformFeesWithdrawn(owner, amt, block.timestamp);
    }

    // ========== INTERNAL SWAP (ETH -> TRIA) ==========
    // Wrap ETH to WETH, approve router, and call exactInputSingle
    // amountOutMinimum provided by caller
    function _swapETHtoTRIA(uint256 ethAmt, uint256 amountOutMinimum) internal returns (uint256) {
        // wrap ETH -> WETH
        weth.deposit{value: ethAmt}();
        // approve swapRouter to spend WETH
        weth.approve(address(swapRouter), ethAmt);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH9,
            tokenOut: TRIA_TOKEN,
            fee: v3Fee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: ethAmt,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);
        return amountOut;
    }

    // ========== VIEW HELPERS ==========
    function getCurrentPeriodInfo() external view returns (uint256 period, uint256 prizePoolTRIA, uint256 totalPoints, uint256 participants, uint256 startTime, uint256 endTime, bool distributed) {
        Period memory p = periods[currentPeriod];
        return (currentPeriod, p.prizePoolTRIA, p.totalPoints, p.participantCount, p.startTime, p.endTime, p.distributed);
    }

    function getPlayerInfo(address player, uint256 period) external view returns (bool hasEntered, uint256 score, uint256 pendingPrizeTRIA, bool claimed, uint256 points) {
        Player memory ps = playerData[period][player];
        return (ps.hasEntered, ps.score, ps.pendingPrizeTRIA, ps.claimed, userPoints[period][player]);
    }

    // ========== ADMIN ==========
    function setV3Fee(uint24 fee) external onlyOwner {
        require(fee == 500 || fee == 3000 || fee == 10000, "Invalid fee");
        v3Fee = fee;
    }

    function emergencyWithdrawTRIA(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero");
        require(triaToken.transfer(to, amount), "transfer failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    receive() external payable {}
}
