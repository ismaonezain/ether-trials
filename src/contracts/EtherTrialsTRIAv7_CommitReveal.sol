tes
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV2Router {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);
    function WETH() external pure returns (address);
}

/**
 * @title EtherTrialsTRIAv7 - Point-Based Prize Distribution
 * @dev Clean structure based on AnimeRPGPrizePoolV2 with:
 * - Wallet-based authentication (no FID)
 * - Commit-reveal score system (20 min window)
 * - Point-based prize distribution (proportional to score)
 * - Claim all periods at once
 * - Daily dice system with exponential pricing
 * - Buyback TRIA + Treasury ETH system
 */
contract EtherTrialsTRIAv7 {
    address public owner;
    IERC20 public triaToken;
    IUniswapV2Router public uniswapRouter;
    
    // Constants
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant REVEAL_WINDOW = 20 minutes;
    uint256 public constant MIN_ENTRY = 0.0001 ether;
    uint256 public constant MAX_ENTRY = 1 ether;
    uint256 public constant BASE_DICE_PRICE = 0.00001 ether;
    uint256 public constant FREE_DICE_PER_PERIOD = 3;
    
    // Fee percentages
    uint256 public constant ENTRY_PRIZE_PERCENT = 85;
    uint256 public constant ENTRY_BUYBACK_PERCENT = 10;
    uint256 public constant ENTRY_TREASURY_PERCENT = 5;
    uint256 public constant DICE_BUYBACK_PERCENT = 80;
    uint256 public constant DICE_TREASURY_PERCENT = 20;
    
    // Current period state
    uint256 public currentPeriod;
    uint256 public periodStartTime;
    
    // Balances
    uint256 public buybackTRIABalance;
    uint256 public treasuryBalance;
    
    struct PeriodInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 triaPool;
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
    
    // Mappings
    mapping(uint256 => PeriodInfo) public periods;
    mapping(uint256 => mapping(address => UserEntry)) public userEntries;
    mapping(uint256 => mapping(address => DiceInfo)) public diceUsage;
    mapping(uint256 => mapping(address => ScoreCommit)) public scoreCommits;
    mapping(uint256 => mapping(address => uint256)) public userPoints;
    mapping(uint256 => mapping(address => uint256)) public pendingPrizes;
    mapping(address => uint256[]) public userPeriods;
    
    // Events
    event PeriodStarted(uint256 indexed period, uint256 startTime);
    event EntryPaid(address indexed user, uint256 indexed period, uint256 amount);
    event DiceRolled(address indexed user, uint256 indexed period, bool isFree, uint256 price);
    event ScoreCommitted(address indexed user, uint256 indexed period, bytes32 commitHash);
    event ScoreRevealed(address indexed user, uint256 indexed period, uint256 score);
    event PrizesAllocated(uint256 indexed period, uint256 totalPrize, uint256 totalPoints);
    event PrizesClaimed(address indexed user, uint256 totalAmount, uint256 periodsCount);
    event BuybackWithdrawn(address indexed owner, uint256 amount);
    event TreasuryWithdrawn(address indexed owner, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(address _triaToken, address _uniswapRouter) {
        owner = msg.sender;
        triaToken = IERC20(_triaToken);
        uniswapRouter = IUniswapV2Router(_uniswapRouter);
        
        // Initialize first period
        currentPeriod = 1;
        periodStartTime = block.timestamp;
        periods[1].startTime = block.timestamp;
        periods[1].endTime = block.timestamp + PERIOD_DURATION;
        
        emit PeriodStarted(1, block.timestamp);
    }
    
    // ============ ENTRY FUNCTIONS ============
    
    function enterTournament() external payable {
        require(msg.value >= MIN_ENTRY && msg.value <= MAX_ENTRY, "Invalid entry amount");
        require(!userEntries[currentPeriod][msg.sender].hasEntered, "Already entered");
        require(block.timestamp < periods[currentPeriod].endTime, "Period ended");
        
        // Split entry fee
        uint256 toPrize = (msg.value * ENTRY_PRIZE_PERCENT) / 100;
        uint256 toBuyback = (msg.value * ENTRY_BUYBACK_PERCENT) / 100;
        uint256 toTreasury = msg.value - toPrize - toBuyback;
        
        periods[currentPeriod].triaPool += toPrize;
        periods[currentPeriod].participants++;
        treasuryBalance += toTreasury;
        
        // Buyback TRIA
        if (toBuyback > 0) {
            _buybackTRIA(toBuyback);
        }
        
        // Record entry
        userEntries[currentPeriod][msg.sender] = UserEntry({
            amount: msg.value,
            entryTime: block.timestamp,
            hasEntered: true
        });
        
        userPeriods[msg.sender].push(currentPeriod);
        
        emit EntryPaid(msg.sender, currentPeriod, msg.value);
    }
    
    // ============ DICE FUNCTIONS ============
    
    function rollDice() external payable {
        require(userEntries[currentPeriod][msg.sender].hasEntered, "Must enter first");
        require(block.timestamp < periods[currentPeriod].endTime, "Period ended");
        
        DiceInfo storage dice = diceUsage[currentPeriod][msg.sender];
        
        // Check if free dice available
        if (dice.freeRollsUsed < FREE_DICE_PER_PERIOD) {
            require(msg.value == 0, "Free dice requires 0 ETH");
            dice.freeRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, true, 0);
        } else {
            // Paid dice - exponential pricing
            uint256 expectedPrice = BASE_DICE_PRICE * (2 ** dice.paidRollsUsed);
            require(msg.value == expectedPrice, "Incorrect dice price");
            
            // Split payment
            uint256 toBuyback = (msg.value * DICE_BUYBACK_PERCENT) / 100;
            uint256 toTreasury = msg.value - toBuyback;
            
            treasuryBalance += toTreasury;
            
            // Buyback TRIA
            if (toBuyback > 0) {
                _buybackTRIA(toBuyback);
            }
            
            dice.paidRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, false, msg.value);
        }
    }
    
    function getNextDicePrice(uint256 period, address user) external view returns (uint256) {
        DiceInfo memory dice = diceUsage[period][user];
        
        if (dice.freeRollsUsed < FREE_DICE_PER_PERIOD) {
            return 0; // Free
        }
        
        return BASE_DICE_PRICE * (2 ** dice.paidRollsUsed);
    }
    
    // ============ COMMIT-REVEAL SCORE ============
    
    function commitScore(bytes32 commitHash) external {
        require(userEntries[currentPeriod][msg.sender].hasEntered, "Must enter first");
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
    
    function revealScore(uint256 score, uint256 nonce) external {
        ScoreCommit storage commit = scoreCommits[currentPeriod][msg.sender];
        require(commit.commitHash != bytes32(0), "No commit found");
        require(!commit.revealed, "Already revealed");
        require(block.timestamp <= commit.commitTime + REVEAL_WINDOW, "Reveal window expired");
        
        // Verify hash
        bytes32 expectedHash = keccak256(abi.encodePacked(score, nonce, msg.sender));
        require(commit.commitHash == expectedHash, "Invalid reveal");
        
        // Record score as points
        commit.score = score;
        commit.revealed = true;
        userPoints[currentPeriod][msg.sender] = score;
        periods[currentPeriod].totalPoints += score;
        
        emit ScoreRevealed(msg.sender, currentPeriod, score);
    }
    
    function canReveal(uint256 period, address user) external view returns (bool) {
        ScoreCommit memory commit = scoreCommits[period][user];
        if (commit.commitHash == bytes32(0) || commit.revealed) {
            return false;
        }
        return block.timestamp <= commit.commitTime + REVEAL_WINDOW;
    }
    
    // ============ PRIZE ALLOCATION (POINT-BASED) ============
    
    function allocatePrizes(uint256 period) external {
        require(block.timestamp >= periods[period].endTime, "Period not ended");
        require(!periods[period].allocated, "Already allocated");
        require(periods[period].totalPoints > 0, "No points to allocate");
        
        PeriodInfo storage periodInfo = periods[period];
        periodInfo.allocated = true;
        
        // Convert ETH prize pool to TRIA (if needed) or keep as TRIA if already bought
        uint256 totalPrize = periodInfo.triaPool;
        
        // Point-based distribution: prize = (userPoints / totalPoints) * totalPrize
        // This will be calculated per-user when they claim
        
        emit PrizesAllocated(period, totalPrize, periodInfo.totalPoints);
    }
    
    // ============ CLAIM ALL PERIODS ============
    
    function claimAllRewards() external {
        uint256[] memory myPeriods = userPeriods[msg.sender];
        uint256 totalClaimable = 0;
        uint256 claimedCount = 0;
        
        for (uint256 i = 0; i < myPeriods.length; i++) {
            uint256 period = myPeriods[i];
            
            // Skip if not allocated or no points
            if (!periods[period].allocated || userPoints[period][msg.sender] == 0) {
                continue;
            }
            
            // Skip if already claimed
            if (pendingPrizes[period][msg.sender] > 0) {
                continue;
            }
            
            // Calculate proportional prize
            uint256 userScore = userPoints[period][msg.sender];
            uint256 totalPoints = periods[period].totalPoints;
            uint256 totalPrize = periods[period].triaPool;
            
            uint256 userPrize = (totalPrize * userScore) / totalPoints;
            
            if (userPrize > 0) {
                pendingPrizes[period][msg.sender] = userPrize;
                totalClaimable += userPrize;
                claimedCount++;
            }
        }
        
        require(totalClaimable > 0, "No rewards to claim");
        
        // Transfer all TRIA at once
        require(triaToken.transfer(msg.sender, totalClaimable), "Transfer failed");
        
        emit PrizesClaimed(msg.sender, totalClaimable, claimedCount);
    }
    
    function getClaimableRewards(address user) external view returns (uint256) {
        uint256[] memory myPeriods = userPeriods[user];
        uint256 totalClaimable = 0;
        
        for (uint256 i = 0; i < myPeriods.length; i++) {
            uint256 period = myPeriods[i];
            
            if (!periods[period].allocated || userPoints[period][user] == 0) {
                continue;
            }
            
            if (pendingPrizes[period][user] > 0) {
                continue;
            }
            
            uint256 userScore = userPoints[period][user];
            uint256 totalPoints = periods[period].totalPoints;
            uint256 totalPrize = periods[period].triaPool;
            
            if (totalPoints > 0) {
                totalClaimable += (totalPrize * userScore) / totalPoints;
            }
        }
        
        return totalClaimable;
    }
    
    // ============ PERIOD MANAGEMENT ============
    
    function startNewPeriod() external {
        require(block.timestamp >= periods[currentPeriod].endTime, "Current period not ended");
        require(periods[currentPeriod].allocated, "Must allocate prizes first");
        
        currentPeriod++;
        periodStartTime = block.timestamp;
        periods[currentPeriod].startTime = block.timestamp;
        periods[currentPeriod].endTime = block.timestamp + PERIOD_DURATION;
        
        emit PeriodStarted(currentPeriod, block.timestamp);
    }
    
    function getCurrentPeriod() external view returns (uint256) {
        return currentPeriod;
    }
    
    function getPeriodInfo(uint256 period) external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 triaPool,
        uint256 participants,
        uint256 totalPoints,
        bool allocated,
        uint256 timeRemaining
    ) {
        PeriodInfo memory info = periods[period];
        uint256 remaining = 0;
        
        if (block.timestamp < info.endTime) {
            remaining = info.endTime - block.timestamp;
        }
        
        return (
            info.startTime,
            info.endTime,
            info.triaPool,
            info.participants,
            info.totalPoints,
            info.allocated,
            remaining
        );
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function withdrawBuyback() external onlyOwner {
        uint256 amount = buybackTRIABalance;
        require(amount > 0, "No buyback to withdraw");
        
        buybackTRIABalance = 0;
        require(triaToken.transfer(owner, amount), "Transfer failed");
        
        emit BuybackWithdrawn(owner, amount);
    }
    
    function withdrawTreasury() external onlyOwner {
        uint256 amount = treasuryBalance;
        require(amount > 0, "No treasury to withdraw");
        
        treasuryBalance = 0;
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit TreasuryWithdrawn(owner, amount);
    }
    
    function getBalances() external view returns (uint256 buyback, uint256 treasury) {
        return (buybackTRIABalance, treasuryBalance);
    }
    
    function injectTRIAToPrizePool(uint256 amount) external onlyOwner {
        require(triaToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        periods[currentPeriod].triaPool += amount;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getUserEntry(uint256 period, address user) external view returns (
        uint256 amount,
        uint256 entryTime,
        bool hasEntered
    ) {
        UserEntry memory entry = userEntries[period][user];
        return (entry.amount, entry.entryTime, entry.hasEntered);
    }
    
    function getDiceInfo(uint256 period, address user) external view returns (
        uint256 freeRollsUsed,
        uint256 freeRollsRemaining,
        uint256 paidRollsUsed,
        uint256 nextPaidPrice
    ) {
        DiceInfo memory dice = diceUsage[period][user];
        uint256 remaining = dice.freeRollsUsed < FREE_DICE_PER_PERIOD 
            ? FREE_DICE_PER_PERIOD - dice.freeRollsUsed 
            : 0;
        uint256 nextPrice = dice.freeRollsUsed < FREE_DICE_PER_PERIOD 
            ? 0 
            : BASE_DICE_PRICE * (2 ** dice.paidRollsUsed);
        
        return (dice.freeRollsUsed, remaining, dice.paidRollsUsed, nextPrice);
    }
    
    function getScoreCommit(uint256 period, address user) external view returns (
        bytes32 commitHash,
        uint256 commitTime,
        uint256 score,
        bool revealed
    ) {
        ScoreCommit memory commit = scoreCommits[period][user];
        return (commit.commitHash, commit.commitTime, commit.score, commit.revealed);
    }
    
    function getUserPoints(uint256 period, address user) external view returns (uint256) {
        return userPoints[period][user];
    }
    
    function getUserPeriods(address user) external view returns (uint256[] memory) {
        return userPeriods[user];
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _buybackTRIA(uint256 ethAmount) internal {
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = address(triaToken);
        
        try uniswapRouter.swapExactETHForTokens{value: ethAmount}(
            0,
            path,
            address(this),
            block.timestamp + 300
        ) returns (uint[] memory amounts) {
            buybackTRIABalance += amounts[1];
        } catch {
            treasuryBalance += ethAmount;
        }
    }
    
    // ============ FALLBACK ============
    
    receive() external payable {}
}
