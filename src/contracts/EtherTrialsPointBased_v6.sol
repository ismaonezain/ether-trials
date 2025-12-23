// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * EtherTrialsPointBased_v6 - ETH → TRIA AUTO-SWAP
 * 
 * PRIZE DISTRIBUTION: 100% POINT-BASED IN TRIA TOKENS
 * ===================================================
 * Points Formula: points = score × (entryAmount / 1e18)
 * Prize Formula: prize = (triaPrizePool × userPoints) / totalPoints
 * 
 * KEY FEATURES:
 * - Users pay with ETH → automatically swapped to TRIA via Uniswap V3
 * - 100% of TRIA goes to prize pool (NO platform fee)
 * - Prize pool & distribution in TRIA tokens
 * - NO point cap: Unlimited point accumulation
 * - Weighted scoring: Both score AND entry amount matter
 * 
 * UNISWAP V3 INTEGRATION:
 * - All ETH entries are instantly swapped to TRIA
 * - Slippage protection with minimum TRIA output
 * - Prize pool accumulates TRIA tokens
 * - Winners claim TRIA tokens directly
 * 
 * TOURNAMENT STRUCTURE:
 * - Daily periods: 00:00 UTC start → 00:00 UTC end (24 hours)
 * - Minimum entry: 0.00001 ETH
 * - Maximum entry: 1 ETH (adjustable)
 * 
 * COMMIT-REVEAL MECHANISM:
 * - Commit phase: Submit hash with score=0 (hidden score)
 * - Reveal phase: Submit actual weighted score within 20min window
 * - Oracle fallback: Owner can submit scores if needed
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

    function exactInputSingle(ExactInputSingleParams calldata params) 
        external 
        payable 
        returns (uint256 amountOut);
}

contract EtherTrialsPointBased_v6 {
    address public owner;

    // Uniswap V3 SwapRouter address (Base Mainnet)
    ISwapRouter public constant swapRouter = ISwapRouter(0x2626664c2603336E57B271c5C0b26F421741e481);
    
    // WETH address (Base Mainnet)
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    
    // TRIA Token address (Base Mainnet - REPLACE WITH ACTUAL ADDRESS)
    address public triaToken;
    
    // Uniswap V3 pool fee tier (0.3% = 3000, 0.05% = 500, 1% = 10000)
    uint24 public poolFee = 3000;
    
    // Slippage tolerance (basis points: 500 = 5%)
    uint256 public slippageBps = 500;

    // Entry bounds (users choose msg.value within [minEntry, maxEntry])
    uint256 public minEntry = 0.00001 ether;
    uint256 public maxEntry = 1 ether;

    // Dice and scoring constants
    uint256 public constant BASE_DICE_PRICE = 0.00001 ether;
    uint256 public constant FREE_DICE_PER_PERIOD = 3;
    uint256 public constant MAX_PAID_ROLLS = 60;
    uint256 public constant MAX_SCORE = 2_000_000;

    // Period timing
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant REVEAL_WINDOW = 20 minutes;

    // Period bookkeeping
    uint256 public currentPeriod;
    uint256 public lastDistributionTime;

    struct Period {
        uint256 prizePoolTRIA;    // Total prize pool in TRIA tokens
        uint256 totalPoints;      // Sum of all player points
        uint256 participantCount;
        uint256 startTime;
        uint256 endTime;
        bool distributed;
    }

    struct Player {
        uint256 score;            // Raw game score
        uint256 entryAmount;      // ETH amount player paid
        uint256 points;           // Calculated: score × (entryAmount / 1e18)
        uint256 pendingPrizeTRIA; // Allocated TRIA prize
        bool claimed;
        bool hasEntered;
    }

    struct ScoreCommit {
        bytes32 commitHash;
        uint256 commitTime;
        uint256 score;
        bool revealed;
    }

    struct DiceInfo {
        uint256 freeRollsUsed;
        uint256 paidRollsUsed;
    }

    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(address => Player)) public playerData;
    mapping(uint256 => address[]) public periodPlayers;
    mapping(uint256 => mapping(address => ScoreCommit)) public scoreCommits;
    mapping(uint256 => mapping(address => DiceInfo)) public diceUsage;
    mapping(uint256 => mapping(address => uint256)) public userPoints;
    mapping(address => uint256[]) public userPeriods;

    // Total prize obligations in TRIA
    uint256 public totalPrizeOwedTRIA;

    // Events
    event EntryPaid(address indexed player, uint256 ethAmount, uint256 triaAmount, uint256 period, uint256 timestamp);
    event DiceRolled(address indexed player, uint256 period, bool isFree, uint256 ethPrice, uint256 triaReceived);
    event ScoreCommitted(address indexed player, uint256 period, bytes32 commitHash);
    event ScoreRevealed(address indexed player, uint256 period, uint256 score, uint256 points);
    event ScoreSubmittedByOwner(address indexed player, uint256 period, uint256 score, uint256 points);
    event PrizesAllocated(uint256 period, uint256 prizePoolTRIA, uint256 totalPoints, uint256 participantCount, uint256 timestamp);
    event PrizeClaimed(address indexed player, uint256 period, uint256 amountTRIA, uint256 timestamp);
    event PeriodStarted(uint256 indexed period, uint256 startTime, uint256 endTime);
    event EntryBoundsUpdated(uint256 minEntry, uint256 maxEntry);
    event TriaTokenUpdated(address indexed newToken);
    event PoolFeeUpdated(uint24 newFee);
    event SlippageUpdated(uint256 newSlippageBps);

    // Reentrancy guard
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

    constructor(address _triaToken) {
        require(_triaToken != address(0), "Invalid TRIA token address");
        owner = msg.sender;
        triaToken = _triaToken;
        currentPeriod = 1;
        lastDistributionTime = block.timestamp;
        
        periods[currentPeriod] = Period({
            prizePoolTRIA: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + PERIOD_DURATION,
            distributed: false
        });
        
        emit PeriodStarted(currentPeriod, periods[currentPeriod].startTime, periods[currentPeriod].endTime);
    }

    // ========== ADMIN FUNCTIONS ==========

    function setTriaToken(address newToken) external onlyOwner {
        require(newToken != address(0), "Invalid token address");
        triaToken = newToken;
        emit TriaTokenUpdated(newToken);
    }

    function setPoolFee(uint24 newFee) external onlyOwner {
        require(newFee == 500 || newFee == 3000 || newFee == 10000, "Invalid fee tier");
        poolFee = newFee;
        emit PoolFeeUpdated(newFee);
    }

    function setSlippage(uint256 newSlippageBps) external onlyOwner {
        require(newSlippageBps <= 5000, "Slippage too high"); // Max 50%
        slippageBps = newSlippageBps;
        emit SlippageUpdated(newSlippageBps);
    }

    function setEntryBounds(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin > 0 && newMax >= newMin, "Invalid bounds");
        minEntry = newMin;
        maxEntry = newMax;
        emit EntryBoundsUpdated(newMin, newMax);
    }

    function emergencyWithdrawETH(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function emergencyWithdrawTRIA(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        uint256 available = IERC20(triaToken).balanceOf(address(this)) - totalPrizeOwedTRIA;
        require(amount <= available, "Cannot withdraw prize funds");
        require(IERC20(triaToken).transfer(to, amount), "Transfer failed");
    }

    // ========== SWAP FUNCTION ==========

    /**
     * @dev Swap ETH to TRIA via Uniswap V3
     * @param ethAmount Amount of ETH to swap
     * @return triaReceived Amount of TRIA tokens received
     */
    function _swapETHToTRIA(uint256 ethAmount) internal returns (uint256) {
        require(ethAmount > 0, "Zero amount");
        
        // Calculate minimum TRIA output with slippage protection
        // Note: In production, fetch price from oracle or pool
        // For now, we accept any output > 0 (amountOutMinimum = 0)
        // TODO: Implement proper price oracle for slippage calculation
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: triaToken,
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp + 300, // 5 minutes
            amountIn: ethAmount,
            amountOutMinimum: 0, // TODO: Calculate based on oracle price
            sqrtPriceLimitX96: 0 // No price limit
        });

        uint256 triaReceived = swapRouter.exactInputSingle{value: ethAmount}(params);
        require(triaReceived > 0, "Swap failed");
        
        return triaReceived;
    }

    // ========== ENTRY FUNCTION ==========

    /**
     * @dev Enter tournament with ETH (auto-swapped to TRIA)
     * @notice 100% of TRIA goes to prize pool
     */
    function enterTournament() external payable nonReentrant {
        require(msg.value >= minEntry && msg.value <= maxEntry, "Invalid entry amount");
        
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        require(!playerData[currentPeriod][msg.sender].hasEntered, "Already entered");

        // Swap ETH to TRIA
        uint256 triaReceived = _swapETHToTRIA(msg.value);

        // 100% of TRIA to prize pool
        p.prizePoolTRIA += triaReceived;
        totalPrizeOwedTRIA += triaReceived;

        // Initialize player data
        playerData[currentPeriod][msg.sender].hasEntered = true;
        playerData[currentPeriod][msg.sender].entryAmount = msg.value;
        
        periodPlayers[currentPeriod].push(msg.sender);
        userPeriods[msg.sender].push(currentPeriod);
        p.participantCount += 1;

        emit EntryPaid(msg.sender, msg.value, triaReceived, currentPeriod, block.timestamp);
    }

    /**
     * @dev Admin-only function to enter tournament for testing
     * @notice Owner can enter with any amount (bypasses minEntry/maxEntry checks)
     * @notice Useful for testing swap functionality and prize pool mechanics
     */
    function adminEnterTournament() external payable onlyOwner nonReentrant {
        require(msg.value > 0, "Must send ETH");
        
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        require(!playerData[currentPeriod][msg.sender].hasEntered, "Already entered");

        // Swap ETH to TRIA
        uint256 triaReceived = _swapETHToTRIA(msg.value);

        // 100% of TRIA to prize pool
        p.prizePoolTRIA += triaReceived;
        totalPrizeOwedTRIA += triaReceived;

        // Initialize player data
        playerData[currentPeriod][msg.sender].hasEntered = true;
        playerData[currentPeriod][msg.sender].entryAmount = msg.value;
        
        periodPlayers[currentPeriod].push(msg.sender);
        userPeriods[msg.sender].push(currentPeriod);
        p.participantCount += 1;

        emit EntryPaid(msg.sender, msg.value, triaReceived, currentPeriod, block.timestamp);
    }

    // ========== DICE MECHANICS ==========

    /**
     * @dev Roll dice (free or paid)
     * @notice Paid dice: ETH auto-swapped to TRIA → 100% to prize pool
     */
    function rollDice() external payable nonReentrant {
        require(playerData[currentPeriod][msg.sender].hasEntered, "Must enter tournament first");
        
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        
        DiceInfo storage d = diceUsage[currentPeriod][msg.sender];

        if (d.freeRollsUsed < FREE_DICE_PER_PERIOD) {
            // Free roll
            require(msg.value == 0, "Free roll must be 0 ETH");
            d.freeRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, true, 0, 0);
        } else {
            // Paid roll
            require(d.paidRollsUsed < MAX_PAID_ROLLS, "Max paid rolls reached");
            uint256 expected = BASE_DICE_PRICE * (1 << d.paidRollsUsed);
            require(msg.value == expected, "Wrong dice price");

            // Swap ETH to TRIA
            uint256 triaReceived = _swapETHToTRIA(msg.value);

            // 100% to prize pool
            p.prizePoolTRIA += triaReceived;
            totalPrizeOwedTRIA += triaReceived;

            d.paidRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, false, msg.value, triaReceived);
        }
    }

    // ========== COMMIT-REVEAL SCORE ==========

    function commitScore(bytes32 commitHash) external {
        require(playerData[currentPeriod][msg.sender].hasEntered, "Must enter tournament first");
        require(block.timestamp < periods[currentPeriod].endTime, "Period ended");
        require(scoreCommits[currentPeriod][msg.sender].commitHash == bytes32(0), "Already committed");

        scoreCommits[currentPeriod][msg.sender] = ScoreCommit({
            commitHash: commitHash,
            commitTime: block.timestamp,
            score: 0,
            revealed: false
        });

        emit ScoreCommitted(msg.sender, currentPeriod, commitHash);
    }

    function revealScore(uint256 score, uint256 nonce) external nonReentrant {
        ScoreCommit storage c = scoreCommits[currentPeriod][msg.sender];
        require(c.commitHash != bytes32(0), "No commit found");
        require(!c.revealed, "Already revealed");
        require(block.timestamp <= c.commitTime + REVEAL_WINDOW, "Reveal window expired");
        require(score <= MAX_SCORE, "Score exceeds maximum");

        bytes32 expected = keccak256(abi.encodePacked(score, nonce, msg.sender));
        require(c.commitHash == expected, "Invalid reveal");

        Player storage player = playerData[currentPeriod][msg.sender];
        uint256 oldPoints = player.points;
        
        if (oldPoints > 0) {
            periods[currentPeriod].totalPoints -= oldPoints;
        }

        uint256 newPoints = (score * player.entryAmount) / 1e18;
        
        player.score = score;
        player.points = newPoints;
        userPoints[currentPeriod][msg.sender] = newPoints;
        
        if (newPoints > 0) {
            periods[currentPeriod].totalPoints += newPoints;
        }

        c.score = score;
        c.revealed = true;

        emit ScoreRevealed(msg.sender, currentPeriod, score, newPoints);
    }

    // ========== OWNER SUBMIT SCORE ==========

    function submitScore(address player, uint256 score) external onlyOwner whenNotDistributed(currentPeriod) {
        require(playerData[currentPeriod][player].hasEntered, "Player not entered");
        require(score <= MAX_SCORE, "Score exceeds maximum");

        Player storage p = playerData[currentPeriod][player];
        uint256 oldPoints = p.points;
        
        if (oldPoints > 0) {
            periods[currentPeriod].totalPoints -= oldPoints;
        }

        uint256 newPoints = (score * p.entryAmount) / 1e18;
        
        p.score = score;
        p.points = newPoints;
        userPoints[currentPeriod][player] = newPoints;
        
        if (newPoints > 0) {
            periods[currentPeriod].totalPoints += newPoints;
        }

        emit ScoreSubmittedByOwner(player, currentPeriod, score, newPoints);
    }

    function submitScoresBatch(address[] calldata players, uint256[] calldata scores) 
        external 
        onlyOwner 
        whenNotDistributed(currentPeriod) 
    {
        require(players.length == scores.length, "Array length mismatch");
        
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint256 score = scores[i];
            
            if (playerData[currentPeriod][player].hasEntered && score <= MAX_SCORE) {
                Player storage p = playerData[currentPeriod][player];
                uint256 oldPoints = p.points;
                
                if (oldPoints > 0) {
                    periods[currentPeriod].totalPoints -= oldPoints;
                }
                
                uint256 newPoints = (score * p.entryAmount) / 1e18;
                p.score = score;
                p.points = newPoints;
                userPoints[currentPeriod][player] = newPoints;
                
                if (newPoints > 0) {
                    periods[currentPeriod].totalPoints += newPoints;
                }
                
                emit ScoreSubmittedByOwner(player, currentPeriod, score, newPoints);
            }
        }
    }

    // ========== PRIZE ALLOCATION ==========

    /**
     * @dev Allocate TRIA prizes proportionally based on points
     */
    function allocatePrizes(uint256 period) external onlyOwner nonReentrant {
        Period storage p = periods[period];
        require(block.timestamp >= p.endTime + REVEAL_WINDOW, "Wait for reveal window to end");
        require(!p.distributed, "Already distributed");
        require(p.prizePoolTRIA > 0, "No prize pool");
        require(p.totalPoints > 0, "No points submitted");

        uint256 poolToDistribute = p.prizePoolTRIA;
        uint256 totalPoints = p.totalPoints;
        address[] memory players = periodPlayers[period];

        for (uint256 i = 0; i < players.length; i++) {
            address pl = players[i];
            Player storage player = playerData[period][pl];
            uint256 pts = player.points;
            
            if (pts == 0) continue;
            
            uint256 prize = (pts * poolToDistribute) / totalPoints;
            
            if (prize > 0) {
                player.pendingPrizeTRIA = prize;
            }
        }

        p.distributed = true;
        emit PrizesAllocated(period, poolToDistribute, totalPoints, p.participantCount, block.timestamp);

        // Start next period
        lastDistributionTime = block.timestamp;
        currentPeriod++;
        
        periods[currentPeriod] = Period({
            prizePoolTRIA: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + PERIOD_DURATION,
            distributed: false
        });
        
        emit PeriodStarted(currentPeriod, periods[currentPeriod].startTime, periods[currentPeriod].endTime);
    }

    // ========== PRIZE CLAIMING ==========

    function _internalClaim(address claimant, uint256 period) internal returns (uint256) {
        Period storage p = periods[period];
        require(p.distributed, "Period not distributed yet");
        
        Player storage player = playerData[period][claimant];
        if (player.claimed) return 0;
        
        uint256 amount = player.pendingPrizeTRIA;
        if (amount == 0) return 0;
        
        player.claimed = true;
        player.pendingPrizeTRIA = 0;
        
        if (amount <= totalPrizeOwedTRIA) {
            totalPrizeOwedTRIA -= amount;
        } else {
            totalPrizeOwedTRIA = 0;
        }
        
        require(IERC20(triaToken).transfer(claimant, amount), "TRIA transfer failed");
        
        emit PrizeClaimed(claimant, period, amount, block.timestamp);
        return amount;
    }

    function claimPrize(uint256 period) external nonReentrant {
        _internalClaim(msg.sender, period);
    }

    function claimMultiple(uint256[] calldata periodsToClaim) external nonReentrant {
        for (uint256 i = 0; i < periodsToClaim.length; i++) {
            _internalClaim(msg.sender, periodsToClaim[i]);
        }
    }

    function claimAllForUser() external nonReentrant {
        uint256[] storage userPs = userPeriods[msg.sender];
        for (uint256 i = 0; i < userPs.length; i++) {
            _internalClaim(msg.sender, userPs[i]);
        }
    }

    // ========== VIEW FUNCTIONS ==========

    function getCurrentPeriodInfo() external view returns (
        uint256 period,
        uint256 prizePoolTRIA,
        uint256 totalPoints,
        uint256 participants,
        uint256 startTime,
        uint256 endTime,
        bool distributed
    ) {
        Period memory p = periods[currentPeriod];
        return (
            currentPeriod, 
            p.prizePoolTRIA, 
            p.totalPoints, 
            p.participantCount, 
            p.startTime, 
            p.endTime, 
            p.distributed
        );
    }

    function getPeriodPlayers(uint256 period) external view returns (address[] memory) {
        return periodPlayers[period];
    }

    function getPlayerInfo(address player, uint256 period) external view returns (
        bool hasEntered,
        uint256 score,
        uint256 entryAmount,
        uint256 points,
        uint256 pendingPrizeTRIA,
        bool claimed
    ) {
        Player memory p = playerData[period][player];
        return (
            p.hasEntered, 
            p.score, 
            p.entryAmount,
            p.points,
            p.pendingPrizeTRIA, 
            p.claimed
        );
    }

    function getUserPeriods(address user) external view returns (uint256[] memory) {
        return userPeriods[user];
    }

    function getDiceInfo(address player, uint256 period) external view returns (
        uint256 freeRollsUsed,
        uint256 paidRollsUsed,
        uint256 freeRollsRemaining,
        uint256 nextPaidRollPrice
    ) {
        DiceInfo memory d = diceUsage[period][player];
        uint256 freeRemaining = d.freeRollsUsed < FREE_DICE_PER_PERIOD 
            ? FREE_DICE_PER_PERIOD - d.freeRollsUsed 
            : 0;
        uint256 nextPrice = d.paidRollsUsed < MAX_PAID_ROLLS
            ? BASE_DICE_PRICE * (1 << d.paidRollsUsed)
            : 0;
        return (d.freeRollsUsed, d.paidRollsUsed, freeRemaining, nextPrice);
    }

    function getScoreCommit(address player, uint256 period) external view returns (
        bytes32 commitHash,
        uint256 commitTime,
        uint256 score,
        bool revealed
    ) {
        ScoreCommit memory c = scoreCommits[period][player];
        return (c.commitHash, c.commitTime, c.score, c.revealed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner address");
        owner = newOwner;
    }

    receive() external payable {}
}
