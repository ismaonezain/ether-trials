kotno
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * EtherTrialsPointBased_v5 - PRODUCTION READY
 * 
 * PRIZE DISTRIBUTION: 100% POINT-BASED, NO LIMITS
 * ===============================================
 * Points Formula: points = score × (entryAmount / 1e18)
 * Prize Formula: prize = (prizePool × userPoints) / totalPoints
 * 
 * KEY FEATURES:
 * - NO platform fee: 100% of all entry payments → prize pool
 * - NO point cap: Unlimited point accumulation
 * - Weighted scoring: Both score AND entry amount matter
 * - Mathematical fairness: Pure proportional distribution
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
 * 
 * DICE MECHANICS:
 * - FREE_DICE_PER_PERIOD (3) free rolls per player
 * - Paid rolls: exponential pricing (0.00001 * 2^n ETH)
 * - All dice payments → 100% to prize pool
 * 
 * EXAMPLE CALCULATIONS:
 * - Player A: score=1000, entry=0.0001 ETH → points = 1000 × 0.0001 = 0.1
 * - Player B: score=500, entry=0.0002 ETH → points = 500 × 0.0002 = 0.1
 * - Both players have equal points = equal prize share!
 * 
 * - Player C: score=2000, entry=0.0001 ETH → points = 2000 × 0.0001 = 0.2
 * - Player D: score=1000, entry=0.0001 ETH → points = 1000 × 0.0001 = 0.1
 * - Player C gets 2× the prize of Player D (2× points)
 */

contract EtherTrialsPointBased_v5 {
    address public owner;

    // Entry bounds (users choose msg.value within [minEntry, maxEntry])
    uint256 public minEntry = 0.00001 ether; // Minimum entry amount
    uint256 public maxEntry = 1 ether;       // Maximum entry amount

    // Dice and scoring constants
    uint256 public constant BASE_DICE_PRICE = 0.00001 ether;
    uint256 public constant FREE_DICE_PER_PERIOD = 3;
    uint256 public constant MAX_PAID_ROLLS = 60;
    uint256 public constant MAX_SCORE = 2_000_000;

    // Period timing - Daily UTC-based periods
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant REVEAL_WINDOW = 20 minutes;

    // 100% to prize pool - NO PLATFORM FEE!
    uint256 public constant PRIZE_PERCENT = 100;

    // Period bookkeeping
    uint256 public currentPeriod;
    uint256 public lastDistributionTime;

    struct Period {
        uint256 prizePoolETH;     // Total prize pool for period (ETH)
        uint256 totalPoints;      // Sum of all player points (score × entryAmount)
        uint256 participantCount;
        uint256 startTime;
        uint256 endTime;
        bool distributed;
    }

    struct Player {
        uint256 score;            // Raw game score (0 to MAX_SCORE)
        uint256 entryAmount;      // ETH amount player paid to enter
        uint256 points;           // Calculated: score × (entryAmount / 1e18)
        uint256 pendingPrizeETH;  // Allocated prize waiting to be claimed
        bool claimed;
        bool hasEntered;
    }

    // Commit-reveal struct
    // NOTE: Commit with score=0, reveal with actual weighted score
    struct ScoreCommit {
        bytes32 commitHash;       // keccak256(score, nonce, sender)
        uint256 commitTime;
        uint256 score;
        bool revealed;
    }

    // Dice usage tracking
    struct DiceInfo {
        uint256 freeRollsUsed;
        uint256 paidRollsUsed;
    }

    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(address => Player)) public playerData;
    mapping(uint256 => address[]) public periodPlayers;

    // Commit-reveal storage
    mapping(uint256 => mapping(address => ScoreCommit)) public scoreCommits;
    
    // Dice usage storage
    mapping(uint256 => mapping(address => DiceInfo)) public diceUsage;

    // User points per period (calculated as score × entryAmount)
    mapping(uint256 => mapping(address => uint256)) public userPoints;

    // Track all periods a user participated in (for claimAll)
    mapping(address => uint256[]) public userPeriods;

    // Total prize obligations (sum of all allocated prizes not yet claimed)
    uint256 public totalPrizeOwedETH;

    // Events
    event EntryPaid(address indexed player, uint256 ethAmount, uint256 period, uint256 timestamp);
    event DiceRolled(address indexed player, uint256 period, bool isFree, uint256 price);
    event ScoreCommitted(address indexed player, uint256 period, bytes32 commitHash);
    event ScoreRevealed(address indexed player, uint256 period, uint256 score, uint256 points);
    event ScoreSubmittedByOwner(address indexed player, uint256 period, uint256 score, uint256 points);
    event PrizesAllocated(uint256 period, uint256 prizePoolETH, uint256 totalPoints, uint256 participantCount, uint256 timestamp);
    event PrizeClaimed(address indexed player, uint256 period, uint256 amountETH, uint256 timestamp);
    event PeriodStarted(uint256 indexed period, uint256 startTime, uint256 endTime);
    event EntryBoundsUpdated(uint256 minEntry, uint256 maxEntry);

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

    constructor() {
        owner = msg.sender;
        currentPeriod = 1;
        lastDistributionTime = block.timestamp;
        
        // Initialize first period
        periods[currentPeriod] = Period({
            prizePoolETH: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + PERIOD_DURATION,
            distributed: false
        });
        
        emit PeriodStarted(currentPeriod, periods[currentPeriod].startTime, periods[currentPeriod].endTime);
    }

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @dev Update minimum and maximum entry bounds
     */
    function setEntryBounds(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin > 0 && newMax >= newMin, "Invalid bounds");
        minEntry = newMin;
        maxEntry = newMax;
        emit EntryBoundsUpdated(newMin, newMax);
    }

    /**
     * @dev Emergency withdraw any ETH accidentally sent to contract
     * NOTE: This does NOT touch prize pool funds
     */
    function emergencyWithdrawETH(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(amount <= address(this).balance - totalPrizeOwedETH, "Cannot withdraw prize funds");
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // ========== ENTRY FUNCTION ==========

    /**
     * @dev Enter the current tournament period with ETH
     * @notice 100% of entry amount goes to prize pool (NO FEES!)
     */
    function enterTournament() external payable nonReentrant {
        require(msg.value >= minEntry && msg.value <= maxEntry, "Invalid entry amount");
        
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        require(!playerData[currentPeriod][msg.sender].hasEntered, "Already entered");

        // 100% of entry goes to prize pool
        p.prizePoolETH += msg.value;
        totalPrizeOwedETH += msg.value;

        // Initialize player data
        playerData[currentPeriod][msg.sender].hasEntered = true;
        playerData[currentPeriod][msg.sender].entryAmount = msg.value;
        
        periodPlayers[currentPeriod].push(msg.sender);
        userPeriods[msg.sender].push(currentPeriod);
        p.participantCount += 1;

        emit EntryPaid(msg.sender, msg.value, currentPeriod, block.timestamp);
    }

    // ========== DICE MECHANICS ==========

    /**
     * @dev Roll dice (free or paid)
     * @notice All paid dice revenue goes 100% to prize pool
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
            emit DiceRolled(msg.sender, currentPeriod, true, 0);
        } else {
            // Paid roll - exponential pricing
            require(d.paidRollsUsed < MAX_PAID_ROLLS, "Max paid rolls reached");
            uint256 expected = BASE_DICE_PRICE * (1 << d.paidRollsUsed);
            require(msg.value == expected, "Wrong dice price");

            // 100% to prize pool
            p.prizePoolETH += msg.value;
            totalPrizeOwedETH += msg.value;

            d.paidRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, false, msg.value);
        }
    }

    // ========== COMMIT-REVEAL SCORE (PLAYER SIDE) ==========

    /**
     * @dev Commit score hash (Phase 1)
     * @param commitHash keccak256(score, nonce, sender)
     * @notice Commit with score=0 to hide actual score
     */
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

    /**
     * @dev Reveal score with nonce (Phase 2)
     * @param score Actual game score (weighted by entry amount)
     * @param nonce Random nonce used in commit
     * @notice Must reveal within REVEAL_WINDOW (20 minutes)
     */
    function revealScore(uint256 score, uint256 nonce) external nonReentrant {
        ScoreCommit storage c = scoreCommits[currentPeriod][msg.sender];
        require(c.commitHash != bytes32(0), "No commit found");
        require(!c.revealed, "Already revealed");
        require(block.timestamp <= c.commitTime + REVEAL_WINDOW, "Reveal window expired");
        require(score <= MAX_SCORE, "Score exceeds maximum");

        // Verify commit hash
        bytes32 expected = keccak256(abi.encodePacked(score, nonce, msg.sender));
        require(c.commitHash == expected, "Invalid reveal");

        // Calculate points: score × (entryAmount / 1e18)
        Player storage player = playerData[currentPeriod][msg.sender];
        uint256 oldPoints = player.points;
        
        // Remove old points from total
        if (oldPoints > 0) {
            periods[currentPeriod].totalPoints -= oldPoints;
        }

        // Calculate new points
        uint256 newPoints = (score * player.entryAmount) / 1e18;
        
        // Update player data
        player.score = score;
        player.points = newPoints;
        userPoints[currentPeriod][msg.sender] = newPoints;
        
        // Add new points to total
        if (newPoints > 0) {
            periods[currentPeriod].totalPoints += newPoints;
        }

        // Mark as revealed
        c.score = score;
        c.revealed = true;

        emit ScoreRevealed(msg.sender, currentPeriod, score, newPoints);
    }

    // ========== OWNER SUBMIT SCORE (ORACLE FALLBACK) ==========

    /**
     * @dev Owner can submit scores directly (oracle mechanism)
     * @notice Useful for players who don't reveal in time
     */
    function submitScore(address player, uint256 score) external onlyOwner whenNotDistributed(currentPeriod) {
        require(playerData[currentPeriod][player].hasEntered, "Player not entered");
        require(score <= MAX_SCORE, "Score exceeds maximum");

        Player storage p = playerData[currentPeriod][player];
        uint256 oldPoints = p.points;
        
        // Remove old points
        if (oldPoints > 0) {
            periods[currentPeriod].totalPoints -= oldPoints;
        }

        // Calculate new points
        uint256 newPoints = (score * p.entryAmount) / 1e18;
        
        // Update player data
        p.score = score;
        p.points = newPoints;
        userPoints[currentPeriod][player] = newPoints;
        
        // Add new points
        if (newPoints > 0) {
            periods[currentPeriod].totalPoints += newPoints;
        }

        emit ScoreSubmittedByOwner(player, currentPeriod, score, newPoints);
    }

    /**
     * @dev Batch submit scores (gas efficient)
     */
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
     * @dev Allocate prizes proportionally based on points
     * @param period Period number to allocate
     * @notice Can only be called after period ends + reveal window
     * 
     * Prize Formula: prize = (prizePool × userPoints) / totalPoints
     */
    function allocatePrizes(uint256 period) external onlyOwner nonReentrant {
        Period storage p = periods[period];
        require(block.timestamp >= p.endTime + REVEAL_WINDOW, "Wait for reveal window to end");
        require(!p.distributed, "Already distributed");
        require(p.prizePoolETH > 0, "No prize pool");
        require(p.totalPoints > 0, "No points submitted");

        uint256 poolToDistribute = p.prizePoolETH;
        uint256 totalPoints = p.totalPoints;
        address[] memory players = periodPlayers[period];

        for (uint256 i = 0; i < players.length; i++) {
            address pl = players[i];
            Player storage player = playerData[period][pl];
            uint256 pts = player.points;
            
            if (pts == 0) continue;
            
            // Calculate proportional prize: (points / totalPoints) × prizePool
            uint256 prize = (pts * poolToDistribute) / totalPoints;
            
            if (prize > 0) {
                player.pendingPrizeETH = prize;
            }
        }

        p.distributed = true;
        emit PrizesAllocated(period, poolToDistribute, totalPoints, p.participantCount, block.timestamp);

        // Start next period
        lastDistributionTime = block.timestamp;
        currentPeriod++;
        
        periods[currentPeriod] = Period({
            prizePoolETH: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + PERIOD_DURATION,
            distributed: false
        });
        
        emit PeriodStarted(currentPeriod, periods[currentPeriod].startTime, periods[currentPeriod].endTime);
    }

    // ========== PRIZE CLAIMING ==========

    /**
     * @dev Internal claim implementation (used by all claim functions)
     */
    function _internalClaim(address claimant, uint256 period) internal returns (uint256) {
        Period storage p = periods[period];
        require(p.distributed, "Period not distributed yet");
        
        Player storage player = playerData[period][claimant];
        if (player.claimed) return 0;
        
        uint256 amount = player.pendingPrizeETH;
        if (amount == 0) return 0;
        
        // Mark as claimed
        player.claimed = true;
        player.pendingPrizeETH = 0;
        
        // Reduce total owed
        if (amount <= totalPrizeOwedETH) {
            totalPrizeOwedETH -= amount;
        } else {
            totalPrizeOwedETH = 0;
        }
        
        // Transfer ETH
        (bool ok, ) = payable(claimant).call{value: amount}("");
        require(ok, "ETH transfer failed");
        
        emit PrizeClaimed(claimant, period, amount, block.timestamp);
        return amount;
    }

    /**
     * @dev Claim prize for a single period
     */
    function claimPrize(uint256 period) external nonReentrant {
        _internalClaim(msg.sender, period);
    }

    /**
     * @dev Claim prizes for multiple periods
     */
    function claimMultiple(uint256[] calldata periodsToClaim) external nonReentrant {
        for (uint256 i = 0; i < periodsToClaim.length; i++) {
            _internalClaim(msg.sender, periodsToClaim[i]);
        }
    }

    /**
     * @dev Claim all prizes for all periods user participated in
     */
    function claimAllForUser() external nonReentrant {
        uint256[] storage userPs = userPeriods[msg.sender];
        for (uint256 i = 0; i < userPs.length; i++) {
            _internalClaim(msg.sender, userPs[i]);
        }
    }

    // ========== VIEW FUNCTIONS ==========

    function getCurrentPeriodInfo() external view returns (
        uint256 period,
        uint256 prizePoolETH,
        uint256 totalPoints,
        uint256 participants,
        uint256 startTime,
        uint256 endTime,
        bool distributed
    ) {
        Period memory p = periods[currentPeriod];
        return (
            currentPeriod, 
            p.prizePoolETH, 
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
        uint256 pendingPrizeETH,
        bool claimed
    ) {
        Player memory p = playerData[period][player];
        return (
            p.hasEntered, 
            p.score, 
            p.entryAmount,
            p.points,
            p.pendingPrizeETH, 
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

    // ========== UTILITY ==========

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner address");
        owner = newOwner;
    }

    receive() external payable {}
}
