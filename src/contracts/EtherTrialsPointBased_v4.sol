// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * EtherTrialsPointBased_v4
 * - ENTRY amount chosen by user (must be between minEntry and maxEntry)
 * - All prize & platform fees are in ETH (no TRIA swap)
 * - Split: PRIZE_PERCENT (80%) to prize pool, PLATFORM_PERCENT (20%) to platform fees (ETH)
 * - Dice mechanics from previous v10: FREE_DICE_PER_PERIOD free, paid dice escalate price
 * - Commit-reveal for scores (players commit & reveal). Owner can still submit scores (oracle)
 * - allocatePrizes distributes ETH proportionally to score (points = score)
 * - claimPrize + claimMultiple + claimAllForUser available
 *
 * NOTE: Deployable to Base (or any EVM). Constructor no longer needs token/router addresses.
 */

contract EtherTrialsPointBased_v4 {
    address public owner;

    // Entry bounds (users choose msg.value within [minEntry, maxEntry])
    uint256 public minEntry = 0.00002 ether; // default
    uint256 public maxEntry = 1 ether;

    // Dice and scoring constants
    uint256 public constant BASE_DICE_PRICE = 0.00001 ether;
    uint256 public constant FREE_DICE_PER_PERIOD = 3;
    uint256 public constant MAX_PAID_ROLLS = 60;
    uint256 public constant MAX_SCORE = 2_000_000;

    // Period timing
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant REVEAL_WINDOW = 20 minutes;

    // Split percentages
    uint256 public constant PRIZE_PERCENT = 80;    // 80% → prize pool
    uint256 public constant PLATFORM_PERCENT = 20; // 20% → platform

    // period bookkeeping
    uint256 public currentPeriod;
    uint256 public lastDistributionTime;

    struct Period {
        uint256 prizePoolETH; // total prize pool for period (ETH)
        uint256 totalPoints;  // sum of points (now pure score)
        uint256 participantCount;
        uint256 startTime;
        uint256 endTime;
        bool distributed;
    }

    struct Player {
        uint256 score;
        uint256 pendingPrizeETH;
        bool claimed;
        bool hasEntered;
    }

    // commit-reveal struct
    struct ScoreCommit {
        bytes32 commitHash;
        uint256 commitTime;
        uint256 score;
        bool revealed;
    }

    // dice usage
    struct DiceInfo {
        uint256 freeRollsUsed;
        uint256 paidRollsUsed;
    }

    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(address => Player)) public playerData;
    mapping(uint256 => address[]) public periodPlayers;

    // commit store
    mapping(uint256 => mapping(address => ScoreCommit)) public scoreCommits;
    // dice usage store
    mapping(uint256 => mapping(address => DiceInfo)) public diceUsage;

    // user points per period (equal to score)
    mapping(uint256 => mapping(address => uint256)) public userPoints;

    // track user periods (for claimAll)
    mapping(address => uint256[]) public userPeriods;

    // accounting for fees and prize obligations (all in ETH)
    uint256 public platformFeesETH;
    uint256 public totalPrizeOwedETH; // sum of all prizePool contributions not yet claimed

    // events
    event EntryPaid(address indexed player, uint256 ethAmount, uint256 toPrize, uint256 toPlatform, uint256 period, uint256 timestamp);
    event DiceRolled(address indexed player, uint256 period, bool isFree, uint256 price);
    event ScoreCommitted(address indexed player, uint256 period, bytes32 commitHash);
    event ScoreRevealed(address indexed player, uint256 period, uint256 score);
    event ScoreSubmittedByOwner(address indexed player, uint256 period, uint256 score);
    event PrizesAllocated(uint256 period, uint256 prizePoolETH, uint256 totalPoints, uint256 participantCount, uint256 timestamp);
    event PrizeClaimed(address indexed player, uint256 period, uint256 amountETH, uint256 timestamp);
    event PlatformFeesWithdrawn(address indexed owner, uint256 amountETH, uint256 timestamp);
    event PeriodStarted(uint256 indexed period, uint256 startTime, uint256 endTime);
    event EntryBoundsUpdated(uint256 minEntry, uint256 maxEntry);

    // reentrancy guard
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

    // ========== ADMIN ==========

    function setEntryBounds(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin > 0 && newMax >= newMin, "Invalid bounds");
        minEntry = newMin;
        maxEntry = newMax;
        emit EntryBoundsUpdated(newMin, newMax);
    }

    // emergency owner withdraw any ETH accidentally stuck (NOT platform fees)
    function emergencyWithdrawETH(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero");
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "withdraw failed");
    }

    // owner withdraw accumulated platform fees (ETH)
    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        // ensure contract has enough ETH to cover outstanding prize obligations
        require(bal >= totalPrizeOwedETH, "Prize shortfall");
        uint256 available = bal - totalPrizeOwedETH;
        uint256 amt = platformFeesETH;
        require(amt > 0 && amt <= available, "Invalid or insufficient available");
        platformFeesETH = 0;
        (bool success, ) = payable(owner).call{value: amt}("");
        require(success, "Transfer failed");
        emit PlatformFeesWithdrawn(owner, amt, block.timestamp);
    }

    // ========== ENTRY ==========

    // user chooses msg.value as entry (must be within bounds)
    function enterTournament() external payable nonReentrant {
        require(msg.value >= minEntry && msg.value <= maxEntry, "Invalid entry amount");
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        require(!playerData[currentPeriod][msg.sender].hasEntered, "Already entered");

        uint256 toPrize = (msg.value * PRIZE_PERCENT) / 100;
        uint256 toPlatform = msg.value - toPrize;

        p.prizePoolETH += toPrize;
        platformFeesETH += toPlatform;
        totalPrizeOwedETH += toPrize;

        playerData[currentPeriod][msg.sender].hasEntered = true;
        periodPlayers[currentPeriod].push(msg.sender);
        userPeriods[msg.sender].push(currentPeriod);
        p.participantCount += 1;

        emit EntryPaid(msg.sender, msg.value, toPrize, toPlatform, currentPeriod, block.timestamp);
    }

    // ========== DICE (free + paid) ==========

    function rollDice() external payable nonReentrant {
        require(playerData[currentPeriod][msg.sender].hasEntered, "Enter first");
        Period storage p = periods[currentPeriod];
        require(block.timestamp < p.endTime, "Period ended");
        DiceInfo storage d = diceUsage[currentPeriod][msg.sender];

        if (d.freeRollsUsed < FREE_DICE_PER_PERIOD) {
            require(msg.value == 0, "Free = 0");
            d.freeRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, true, 0);
        } else {
            require(d.paidRollsUsed < MAX_PAID_ROLLS, "Max paid rolls");
            uint256 expected = BASE_DICE_PRICE * (1 << d.paidRollsUsed);
            require(msg.value == expected, "Wrong dice price");

            uint256 toPrize = (msg.value * PRIZE_PERCENT) / 100;
            uint256 toPlatform = msg.value - toPrize;

            p.prizePoolETH += toPrize;
            platformFeesETH += toPlatform;
            totalPrizeOwedETH += toPrize;

            d.paidRollsUsed++;
            emit DiceRolled(msg.sender, currentPeriod, false, msg.value);
        }
    }

    // ========== COMMIT / REVEAL SCORE (player side) ==========

    // player commits keccak256(score, nonce, sender)
    function commitScore(bytes32 commitHash) external {
        require(playerData[currentPeriod][msg.sender].hasEntered, "Enter first");
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

    // reveal score with nonce; must be within REVEAL_WINDOW
    function revealScore(uint256 score, uint256 nonce) external nonReentrant {
        ScoreCommit storage c = scoreCommits[currentPeriod][msg.sender];
        require(c.commitHash != bytes32(0), "No commit");
        require(!c.revealed, "Already revealed");
        require(block.timestamp <= c.commitTime + REVEAL_WINDOW, "Reveal window expired");
        require(score <= MAX_SCORE, "Score too high");

        bytes32 expected = keccak256(abi.encodePacked(score, nonce, msg.sender));
        require(c.commitHash == expected, "Invalid reveal");

        // update player score and points
        uint256 oldPoints = userPoints[currentPeriod][msg.sender];
        if (oldPoints > 0) {
            periods[currentPeriod].totalPoints -= oldPoints;
        }

        playerData[currentPeriod][msg.sender].score = score;
        userPoints[currentPeriod][msg.sender] = score;
        if (score > 0) periods[currentPeriod].totalPoints += score;

        c.score = score;
        c.revealed = true;

        emit ScoreRevealed(msg.sender, currentPeriod, score);
    }

    // ========== OWNER SUBMIT SCORE (oracle) ==========
    // keep for operator/oracle convenience
    function submitScore(address player, uint256 score) external onlyOwner whenNotDistributed(currentPeriod) {
        require(playerData[currentPeriod][player].hasEntered, "Player not entered");
        require(score <= MAX_SCORE, "Score too high");

        uint256 oldPoints = userPoints[currentPeriod][player];
        if (oldPoints > 0) periods[currentPeriod].totalPoints -= oldPoints;

        playerData[currentPeriod][player].score = score;
        userPoints[currentPeriod][player] = score;
        if (score > 0) periods[currentPeriod].totalPoints += score;

        emit ScoreSubmittedByOwner(player, currentPeriod, score);
    }

    // batch owner submit
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
                emit ScoreSubmittedByOwner(player, currentPeriod, score);
            }
        }
    }

    // ========== ALLOCATE PRIZES (owner) ==========
    // Distribute ETH prize pool proportionally to points (scores)
    function allocatePrizes(uint256 period) external onlyOwner nonReentrant {
        Period storage p = periods[period];
        require(block.timestamp >= p.endTime + REVEAL_WINDOW, "Wait for reveal window");
        require(!p.distributed, "Already distributed");
        require(p.prizePoolETH > 0, "No prize pool");
        require(p.totalPoints > 0, "No points submitted");

        uint256 poolToDistribute = p.prizePoolETH;
        uint256 totalPoints = p.totalPoints;
        address[] memory players = periodPlayers[period];
        uint256 allocatedTotal = 0;

        for (uint256 i = 0; i < players.length; i++) {
            address pl = players[i];
            uint256 pts = userPoints[period][pl];
            if (pts == 0) continue;
            uint256 prize = (pts * poolToDistribute) / totalPoints;
            if (prize > 0) {
                playerData[period][pl].pendingPrizeETH = prize;
                allocatedTotal += prize;
            }
        }

        p.distributed = true;
        emit PrizesAllocated(period, poolToDistribute, totalPoints, p.participantCount, block.timestamp);

        // Move time forward and open next period
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

    // ========== CLAIMING ==========

    // internal claim implementation (no nonReentrant) used by batch claims
    function _internalClaim(address claimant, uint256 period) internal returns (uint256) {
        Period storage p = periods[period];
        require(p.distributed, "Period not distributed");
        Player storage ps = playerData[period][claimant];
        if (ps.claimed) return 0;
        uint256 amount = ps.pendingPrizeETH;
        if (amount == 0) return 0;
        ps.claimed = true;
        ps.pendingPrizeETH = 0;
        // reduce owed amount
        if (amount <= totalPrizeOwedETH) {
            totalPrizeOwedETH -= amount;
        } else {
            totalPrizeOwedETH = 0;
        }
        (bool ok, ) = payable(claimant).call{value: amount}("");
        require(ok, "Transfer failed");
        emit PrizeClaimed(claimant, period, amount, block.timestamp);
        return amount;
    }

    // claim single period
    function claimPrize(uint256 period) external nonReentrant {
        _internalClaim(msg.sender, period);
    }

    // claim multiple specified periods
    function claimMultiple(uint256[] calldata periodsToClaim) external nonReentrant {
        for (uint256 i = 0; i < periodsToClaim.length; i++) {
            _internalClaim(msg.sender, periodsToClaim[i]);
        }
    }

    // claim all periods the user participated in (tracked via userPeriods)
    function claimAllForUser() external nonReentrant {
        uint256[] storage userPs = userPeriods[msg.sender];
        for (uint256 i = 0; i < userPs.length; i++) {
            _internalClaim(msg.sender, userPs[i]);
        }
    }

    // ========== VIEWS ==========

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
        return (currentPeriod, p.prizePoolETH, p.totalPoints, p.participantCount, p.startTime, p.endTime, p.distributed);
    }

    function getPeriodPlayers(uint256 period) external view returns (address[] memory) {
        return periodPlayers[period];
    }

    function getPlayerInfo(address player, uint256 period) external view returns (
        bool hasEntered,
        uint256 score,
        uint256 pendingPrizeETH,
        bool claimed,
        uint256 points
    ) {
        Player memory ps = playerData[period][player];
        return (ps.hasEntered, ps.score, ps.pendingPrizeETH, ps.claimed, userPoints[period][player]);
    }

    function getUserPeriods(address user) external view returns (uint256[] memory) {
        return userPeriods[user];
    }

    // ========== UTIL ==========

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    receive() external payable {}
}
