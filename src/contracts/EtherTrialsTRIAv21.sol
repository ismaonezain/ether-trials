kotno
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ███████╗████████╗██╗  ██╗███████╗██████╗     ████████╗██████╗ ██╗ █████╗ ██╗     ███████╗
 * ██╔════╝╚══██╔══╝██║  ██║██╔════╝██╔══██╗    ╚══██╔══╝██╔══██╗██║██╔══██╗██║     ██╔════╝
 * █████╗     ██║   ███████║█████╗  ██████╔╝       ██║   ██████╔╝██║███████║██║     ███████╗
 * ██╔══╝     ██║   ██╔══██║██╔══╝  ██╔══██╗       ██║   ██╔══██╗██║██╔══██║██║     ╚════██║
 * ███████╗   ██║   ██║  ██║███████╗██║  ██║       ██║   ██║  ██║██║██║  ██║███████╗███████║
 * ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝       ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝╚══════╝
 * 
 * EtherTrialsTRIAv21 - SIMPLIFIED SCORING
 * 
 * PAYMENT: TRIA tokens only
 * NETWORK: Base Mainnet (Chain ID: 8453)
 * DEPLOYED: 2025-01-19
 * 
 * SETTINGS:
 * - Entry: 50,000 - 6,000,000,000 TRIA (adjustable)
 * - Period: 24 hours (starts 00:00 UTC daily)
 * - Reveal Window: 20 minutes
 * 
 * CHANGES FROM V20:
 * ✅ Frontend calculates weighted scores (score × entry / 6B TRIA)
 * ✅ Contract only stores and allocates - NO calculation needed!
 * ✅ Period aligned to 00:00 UTC
 * ✅ Gas efficient - simpler logic
 * ✅ No arithmetic overflow issues
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract EtherTrialsTRIAv21 {
    address public owner;

    // ========== TOKEN ==========
    address public constant TRIA_TOKEN = 0xD852713dD8dDF61316DA19383D0c427aDb85EB07;

    // ========== GAME PARAMETERS ==========
    uint256 public minEntry = 50_000 ether; // 50,000 TRIA
    uint256 public maxEntry = 6_000_000_000 ether; // 6B TRIA
    
    uint256 public constant BASE_DICE_PRICE = 1000 ether; // 1000 TRIA
    uint256 public constant FREE_DICE_PER_PERIOD = 3;
    uint256 public constant MAX_PAID_ROLLS = 60;
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant REVEAL_WINDOW = 20 minutes;

    // ========== STATE ==========
    uint256 public currentPeriod;
    uint256 public lastDistributionTime;
    uint256 public totalPrizeOwedTRIA;

    struct Period {
        uint256 prizePoolTRIA;
        uint256 totalPoints;
        uint256 participantCount;
        uint256 startTime;
        uint256 endTime;
        bool distributed;
    }

    struct Player {
        uint256 points;
        uint256 entryAmount;
        uint256 pendingPrizeTRIA;
        bool claimed;
        bool hasEntered;
    }

    struct ScoreCommit {
        bytes32 commitHash;
        uint256 commitTime;
        uint256 points;
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

    event EntryPaid(address indexed player, uint256 triaAmount, uint256 period, uint256 timestamp);
    event DiceRolled(address indexed player, uint256 period, bool isFree, uint256 triaPrice);
    event ScoreCommitted(address indexed player, uint256 period, bytes32 commitHash);
    event ScoreRevealed(address indexed player, uint256 period, uint256 points);
    event PointsSubmittedByOwner(address indexed player, uint256 period, uint256 points);
    event PrizesAllocated(uint256 period, uint256 prizePoolTRIA, uint256 totalPoints, uint256 participantCount, uint256 timestamp);
    event PrizeClaimed(address indexed player, uint256 period, uint256 amountTRIA, uint256 timestamp);
    event PeriodStarted(uint256 indexed period, uint256 startTime, uint256 endTime);
    event EntryBoundsUpdated(uint256 minEntry, uint256 maxEntry);

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
        
        // Calculate next 00:00 UTC
        uint256 nextMidnight = _getNextMidnightUTC(block.timestamp);
        
        periods[currentPeriod] = Period({
            prizePoolTRIA: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: nextMidnight,
            distributed: false
        });
        
        emit PeriodStarted(currentPeriod, periods[currentPeriod].startTime, periods[currentPeriod].endTime);
    }

    // ========== UTILITY ==========

    /**
     * @dev Calculate next 00:00 UTC timestamp
     */
    function _getNextMidnightUTC(uint256 timestamp) internal pure returns (uint256) {
        uint256 dayStart = (timestamp / 1 days) * 1 days;
        return dayStart + 1 days;
    }

    // ========== ADMIN ==========

    function setEntryBounds(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin > 0, "Min must be positive");
        require(newMax >= newMin, "Max must be >= min");
        minEntry = newMin;
        maxEntry = newMax;
        emit EntryBoundsUpdated(newMin, newMax);
    }

    function emergencyWithdrawTRIA(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        uint256 available = IERC20(TRIA_TOKEN).balanceOf(address(this)) - totalPrizeOwedTRIA;
        require(amount <= available, "Cannot withdraw prize funds");
        require(IERC20(TRIA_TOKEN).transfer(to, amount), "Transfer failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner address");
        owner = newOwner;
    }

    // ========== ENTRY (UNIFIED FOR ALL USERS) ==========

    /**
     * @dev Enter tournament with TRIA tokens
     * Works for all users including owner
     * Players must approve this contract first
     */
    function enterTournament(uint256 triaAmount) external nonReentrant {
        require(triaAmount >= minEntry && triaAmount <= maxEntry, "Invalid entry amount");
        
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        require(!playerData[currentPeriod][msg.sender].hasEntered, "Already entered");

        require(
            IERC20(TRIA_TOKEN).transferFrom(msg.sender, address(this), triaAmount),
            "TRIA transfer failed"
        );

        p.prizePoolTRIA += triaAmount;
        totalPrizeOwedTRIA += triaAmount;

        playerData[currentPeriod][msg.sender].hasEntered = true;
        playerData[currentPeriod][msg.sender].entryAmount = triaAmount;
        
        periodPlayers[currentPeriod].push(msg.sender);
        userPeriods[msg.sender].push(currentPeriod);
        p.participantCount += 1;

        emit EntryPaid(msg.sender, triaAmount, currentPeriod, block.timestamp);
    }

    // ========== DICE ==========

    function rollDice(uint256 triaAmount) external nonReentrant {
        require(playerData[currentPeriod][msg.sender].hasEntered, "Must enter tournament first");
        
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        
        DiceInfo storage d = diceUsage[currentPeriod][msg.sender];

        if (d.freeRollsUsed < FREE_DICE_PER_PERIOD) {
            require(triaAmount == 0, "Free roll must be 0 TRIA");
            d.freeRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, true, 0);
        } else {
            require(d.paidRollsUsed < MAX_PAID_ROLLS, "Max paid rolls reached");
            
            uint256 expected = BASE_DICE_PRICE * (1 << d.paidRollsUsed);
            if (expected > maxEntry) expected = maxEntry;
            
            require(triaAmount == expected, "Wrong dice price");

            require(
                IERC20(TRIA_TOKEN).transferFrom(msg.sender, address(this), triaAmount),
                "TRIA transfer failed"
            );

            p.prizePoolTRIA += triaAmount;
            totalPrizeOwedTRIA += triaAmount;

            d.paidRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, false, triaAmount);
        }
    }

    // ========== SCORING ==========

    /**
     * @dev Commit weighted score (calculated by frontend)
     * Frontend calculates: points = score × (entry / 6B TRIA)
     */
    function commitScore(bytes32 commitHash) external {
        require(playerData[currentPeriod][msg.sender].hasEntered, "Must enter tournament first");
        require(block.timestamp < periods[currentPeriod].endTime, "Period ended");
        require(scoreCommits[currentPeriod][msg.sender].commitHash == bytes32(0), "Already committed");

        scoreCommits[currentPeriod][msg.sender] = ScoreCommit({
            commitHash: commitHash,
            commitTime: block.timestamp,
            points: 0,
            revealed: false
        });

        emit ScoreCommitted(msg.sender, currentPeriod, commitHash);
    }

    /**
     * @dev Reveal weighted score
     * @param points Weighted score calculated by frontend (score × entry / 6B TRIA)
     */
    function revealScore(uint256 points, uint256 nonce) external nonReentrant {
        ScoreCommit storage c = scoreCommits[currentPeriod][msg.sender];
        require(c.commitHash != bytes32(0), "No commit found");
        require(!c.revealed, "Already revealed");
        require(block.timestamp <= c.commitTime + REVEAL_WINDOW, "Reveal window expired");
        require(block.timestamp <= periods[currentPeriod].endTime, "Must reveal before period ends");
        require(points > 0, "Points must be positive");

        bytes32 expected = keccak256(abi.encodePacked(points, nonce, msg.sender));
        require(c.commitHash == expected, "Invalid reveal");

        Player storage player = playerData[currentPeriod][msg.sender];
        uint256 oldPoints = player.points;
        
        if (oldPoints > 0) {
            periods[currentPeriod].totalPoints -= oldPoints;
        }
        
        player.points = points;
        userPoints[currentPeriod][msg.sender] = points;
        
        periods[currentPeriod].totalPoints += points;

        c.points = points;
        c.revealed = true;

        emit ScoreRevealed(msg.sender, currentPeriod, points);
    }

    /**
     * @dev Submit weighted score for a player (owner only)
     * @param points Weighted score calculated by frontend (score × entry / 6B TRIA)
     */
    function submitPoints(address player, uint256 points) external onlyOwner whenNotDistributed(currentPeriod) {
        require(playerData[currentPeriod][player].hasEntered, "Player not entered");
        require(points > 0, "Points must be positive");

        Player storage p = playerData[currentPeriod][player];
        uint256 oldPoints = p.points;
        
        if (oldPoints > 0) {
            periods[currentPeriod].totalPoints -= oldPoints;
        }
        
        p.points = points;
        userPoints[currentPeriod][player] = points;
        
        periods[currentPeriod].totalPoints += points;

        emit PointsSubmittedByOwner(player, currentPeriod, points);
    }

    /**
     * @dev Batch submit weighted scores (owner only)
     * @param points Array of weighted scores calculated by frontend
     */
    function submitPointsBatch(address[] calldata players, uint256[] calldata points) 
        external 
        onlyOwner 
        whenNotDistributed(currentPeriod) 
    {
        require(players.length == points.length, "Array length mismatch");
        
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint256 pts = points[i];
            
            if (playerData[currentPeriod][player].hasEntered && pts > 0) {
                Player storage p = playerData[currentPeriod][player];
                uint256 oldPoints = p.points;
                
                if (oldPoints > 0) {
                    periods[currentPeriod].totalPoints -= oldPoints;
                }
                
                p.points = pts;
                userPoints[currentPeriod][player] = pts;
                periods[currentPeriod].totalPoints += pts;
                
                emit PointsSubmittedByOwner(player, currentPeriod, pts);
            }
        }
    }

    // ========== PRIZES ==========

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

        lastDistributionTime = block.timestamp;
        currentPeriod++;
        
        // Next period starts at next 00:00 UTC
        uint256 nextMidnight = _getNextMidnightUTC(block.timestamp);
        
        periods[currentPeriod] = Period({
            prizePoolTRIA: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: nextMidnight,
            distributed: false
        });
        
        emit PeriodStarted(currentPeriod, periods[currentPeriod].startTime, periods[currentPeriod].endTime);
    }

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
        
        require(IERC20(TRIA_TOKEN).transfer(claimant, amount), "TRIA transfer failed");
        
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

    // ========== VIEWS ==========

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
        return (currentPeriod, p.prizePoolTRIA, p.totalPoints, p.participantCount, p.startTime, p.endTime, p.distributed);
    }

    function getPeriodPlayers(uint256 period) external view returns (address[] memory) {
        return periodPlayers[period];
    }

    function getPlayerInfo(address player, uint256 period) external view returns (
        bool hasEntered,
        uint256 points,
        uint256 entryAmount,
        uint256 pendingPrizeTRIA,
        bool claimed
    ) {
        Player memory p = playerData[period][player];
        return (p.hasEntered, p.points, p.entryAmount, p.pendingPrizeTRIA, p.claimed);
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
        uint256 freeRemaining = d.freeRollsUsed < FREE_DICE_PER_PERIOD ? FREE_DICE_PER_PERIOD - d.freeRollsUsed : 0;
        uint256 nextPrice = 0;
        if (d.paidRollsUsed < MAX_PAID_ROLLS) {
            nextPrice = BASE_DICE_PRICE * (1 << d.paidRollsUsed);
            if (nextPrice > maxEntry) nextPrice = maxEntry;
        }
        return (d.freeRollsUsed, d.paidRollsUsed, freeRemaining, nextPrice);
    }

    function getScoreCommit(address player, uint256 period) external view returns (
        bytes32 commitHash,
        uint256 commitTime,
        uint256 points,
        bool revealed
    ) {
        ScoreCommit memory c = scoreCommits[period][player];
        return (c.commitHash, c.commitTime, c.points, c.revealed);
    }

    /**
     * @dev Get next period end time (next 00:00 UTC)
     */
    function getNextPeriodEnd() external view returns (uint256) {
        return _getNextMidnightUTC(block.timestamp);
    }

    function version() external pure returns (string memory) {
        return "v21.0.0-simplified-scoring";
    }
}
