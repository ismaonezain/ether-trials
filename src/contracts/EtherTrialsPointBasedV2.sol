// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrialsPointBasedV2
 * @dev Point-based linear reward system with BATCH CLAIM support
 * 
 * NEW FEATURES:
 * - claimPrizeBatch(uint256[] periods) - Claim multiple periods in ONE transaction
 * - claimAllPrizes() - Automatically claim ALL unclaimed prizes
 * - Gas optimized batch operations
 * 
 * UNCHANGED:
 * - Entry Fee: 0.00002 ETH (50% prize + 50% platform)
 * - Linear rewards based on player scores
 * - 24h distribution periods
 * 
 * Deploy to Base Network (chainId: 8453)
 */
contract EtherTrialsPointBasedV2 {
    address public owner;
    
    // Constants
    uint256 public constant ENTRY_FEE = 0.00002 ether;
    uint256 public constant PLATFORM_FEE = 0.00001 ether;      // 50%
    uint256 public constant PRIZE_CONTRIBUTION = 0.00001 ether; // 50%
    uint256 public constant DISTRIBUTION_INTERVAL = 24 hours;
    
    // Current period state
    uint256 public currentPrizePool;
    uint256 public platformBalance;
    uint256 public lastDistributionTime;
    uint256 public currentPeriod;
    uint256 public totalParticipantsCurrentPeriod;
    
    // Period data
    struct Period {
        uint256 prizePool;
        uint256 totalPoints;
        uint256 participantCount;
        uint256 startTime;
        uint256 endTime;
        bool distributed;
    }
    
    // Player score data for each period
    struct PlayerScore {
        uint256 score;
        uint256 pendingPrize;
        bool claimed;
        bool hasEntered;
    }
    
    // Mappings
    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(address => PlayerScore)) public playerScores;
    mapping(uint256 => address[]) public periodPlayers;
    
    // Events
    event EntryFeePaid(address indexed player, uint256 amount, uint256 period, uint256 timestamp);
    event ScoreSubmitted(address indexed player, uint256 score, uint256 period, uint256 timestamp);
    event PrizesAllocated(uint256 period, uint256 totalAmount, uint256 totalPoints, uint256 participantCount, uint256 timestamp);
    event PrizeClaimed(address indexed player, uint256 period, uint256 amount, uint256 timestamp);
    event PrizesBatchClaimed(address indexed player, uint256[] periods, uint256 totalAmount, uint256 timestamp);
    event PlatformFeesWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        lastDistributionTime = block.timestamp;
        currentPeriod = 1;
        
        periods[currentPeriod] = Period({
            prizePool: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + DISTRIBUTION_INTERVAL,
            distributed: false
        });
    }
    
    /**
     * @dev Pay entry fee to join current period
     */
    function payEntryFee() external payable {
        require(msg.value == ENTRY_FEE, "Incorrect entry fee");
        require(!playerScores[currentPeriod][msg.sender].hasEntered, "Already entered this period");
        
        currentPrizePool += PRIZE_CONTRIBUTION;
        platformBalance += PLATFORM_FEE;
        
        playerScores[currentPeriod][msg.sender].hasEntered = true;
        totalParticipantsCurrentPeriod++;
        
        periodPlayers[currentPeriod].push(msg.sender);
        
        emit EntryFeePaid(msg.sender, msg.value, currentPeriod, block.timestamp);
    }
    
    /**
     * @dev Submit player score (called by backend/oracle)
     */
    function submitScore(address player, uint256 score) external onlyOwner {
        require(playerScores[currentPeriod][player].hasEntered, "Player not entered");
        require(!periods[currentPeriod].distributed, "Period already distributed");
        
        if (score > playerScores[currentPeriod][player].score) {
            periods[currentPeriod].totalPoints -= playerScores[currentPeriod][player].score;
            playerScores[currentPeriod][player].score = score;
            periods[currentPeriod].totalPoints += score;
            
            emit ScoreSubmitted(player, score, currentPeriod, block.timestamp);
        }
    }
    
    /**
     * @dev Submit multiple scores in batch
     */
    function submitScoresBatch(address[] calldata players, uint256[] calldata scores) external onlyOwner {
        require(players.length == scores.length, "Arrays length mismatch");
        require(!periods[currentPeriod].distributed, "Period already distributed");
        
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint256 score = scores[i];
            
            if (playerScores[currentPeriod][player].hasEntered && score > playerScores[currentPeriod][player].score) {
                periods[currentPeriod].totalPoints -= playerScores[currentPeriod][player].score;
                playerScores[currentPeriod][player].score = score;
                periods[currentPeriod].totalPoints += score;
                
                emit ScoreSubmitted(player, score, currentPeriod, block.timestamp);
            }
        }
    }
    
    /**
     * @dev Allocate prizes based on linear point distribution
     */
    function allocatePrizes() external onlyOwner {
        require(block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL, "Distribution interval not reached");
        require(!periods[currentPeriod].distributed, "Period already distributed");
        require(currentPrizePool > 0, "No prize pool");
        require(periods[currentPeriod].totalPoints > 0, "No scores submitted");
        
        uint256 poolToDistribute = currentPrizePool;
        uint256 totalPoints = periods[currentPeriod].totalPoints;
        
        address[] memory players = periodPlayers[currentPeriod];
        uint256 allocatedTotal = 0;
        
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint256 score = playerScores[currentPeriod][player].score;
            
            if (score > 0) {
                uint256 prize = (score * poolToDistribute) / totalPoints;
                
                if (prize > 0) {
                    playerScores[currentPeriod][player].pendingPrize = prize;
                    allocatedTotal += prize;
                }
            }
        }
        
        periods[currentPeriod].prizePool = poolToDistribute;
        periods[currentPeriod].participantCount = totalParticipantsCurrentPeriod;
        periods[currentPeriod].distributed = true;
        
        emit PrizesAllocated(currentPeriod, poolToDistribute, totalPoints, players.length, block.timestamp);
        
        currentPrizePool = 0;
        totalParticipantsCurrentPeriod = 0;
        lastDistributionTime = block.timestamp;
        currentPeriod++;
        
        periods[currentPeriod] = Period({
            prizePool: 0,
            totalPoints: 0,
            participantCount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + DISTRIBUTION_INTERVAL,
            distributed: false
        });
    }
    
    /**
     * @dev Player claims prize from single period
     */
    function claimPrize(uint256 period) external {
        require(periods[period].distributed, "Period not distributed");
        require(!playerScores[period][msg.sender].claimed, "Already claimed");
        require(playerScores[period][msg.sender].pendingPrize > 0, "No prize to claim");
        
        uint256 amount = playerScores[period][msg.sender].pendingPrize;
        playerScores[period][msg.sender].claimed = true;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit PrizeClaimed(msg.sender, period, amount, block.timestamp);
    }
    
    /**
     * @dev 🆕 BATCH CLAIM - Claim prizes from multiple periods in ONE transaction
     * @param _periods Array of period numbers to claim from
     * 
     * Gas efficient: Only one transaction for all claims
     * Automatically skips periods with no prize or already claimed
     */
    function claimPrizeBatch(uint256[] calldata _periods) external {
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < _periods.length; i++) {
            uint256 period = _periods[i];
            
            // Skip if not distributed, already claimed, or no prize
            if (!periods[period].distributed) continue;
            if (playerScores[period][msg.sender].claimed) continue;
            if (playerScores[period][msg.sender].pendingPrize == 0) continue;
            
            uint256 amount = playerScores[period][msg.sender].pendingPrize;
            playerScores[period][msg.sender].claimed = true;
            totalAmount += amount;
            
            emit PrizeClaimed(msg.sender, period, amount, block.timestamp);
        }
        
        require(totalAmount > 0, "No prizes to claim");
        
        (bool success, ) = payable(msg.sender).call{value: totalAmount}("");
        require(success, "Transfer failed");
        
        emit PrizesBatchClaimed(msg.sender, _periods, totalAmount, block.timestamp);
    }
    
    /**
     * @dev 🆕 CLAIM ALL - Automatically claim ALL unclaimed prizes from all periods
     * 
     * Ultra convenient: Just call this once to claim everything!
     * Iterates through all periods and claims any available prizes
     */
    function claimAllPrizes() external {
        uint256 totalAmount = 0;
        uint256[] memory claimedPeriods = new uint256[](currentPeriod);
        uint256 claimedCount = 0;
        
        // Iterate through all periods
        for (uint256 period = 1; period < currentPeriod; period++) {
            // Skip if not distributed, already claimed, or no prize
            if (!periods[period].distributed) continue;
            if (playerScores[period][msg.sender].claimed) continue;
            if (playerScores[period][msg.sender].pendingPrize == 0) continue;
            
            uint256 amount = playerScores[period][msg.sender].pendingPrize;
            playerScores[period][msg.sender].claimed = true;
            totalAmount += amount;
            claimedPeriods[claimedCount] = period;
            claimedCount++;
            
            emit PrizeClaimed(msg.sender, period, amount, block.timestamp);
        }
        
        require(totalAmount > 0, "No prizes to claim");
        
        (bool success, ) = payable(msg.sender).call{value: totalAmount}("");
        require(success, "Transfer failed");
        
        // Trim array to actual size
        uint256[] memory finalPeriods = new uint256[](claimedCount);
        for (uint256 i = 0; i < claimedCount; i++) {
            finalPeriods[i] = claimedPeriods[i];
        }
        
        emit PrizesBatchClaimed(msg.sender, finalPeriods, totalAmount, block.timestamp);
    }
    
    /**
     * @dev Owner withdraws platform fees
     */
    function withdrawPlatformFees() external onlyOwner {
        require(platformBalance > 0, "No fees to withdraw");
        
        uint256 amount = platformBalance;
        platformBalance = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit PlatformFeesWithdrawn(owner, amount, block.timestamp);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getCurrentPeriodInfo() external view returns (
        uint256 period,
        uint256 prizePool,
        uint256 totalPoints,
        uint256 participants,
        uint256 startTime,
        uint256 endTime,
        bool distributed
    ) {
        Period memory p = periods[currentPeriod];
        return (
            currentPeriod,
            currentPrizePool,
            p.totalPoints,
            totalParticipantsCurrentPeriod,
            p.startTime,
            p.endTime,
            p.distributed
        );
    }
    
    function getPeriodInfo(uint256 period) external view returns (
        uint256 prizePool,
        uint256 totalPoints,
        uint256 participantCount,
        uint256 startTime,
        uint256 endTime,
        bool distributed
    ) {
        Period memory p = periods[period];
        return (p.prizePool, p.totalPoints, p.participantCount, p.startTime, p.endTime, p.distributed);
    }
    
    function getPlayerInfo(address player, uint256 period) external view returns (
        bool hasEntered,
        uint256 score,
        uint256 pendingPrize,
        bool claimed
    ) {
        PlayerScore memory ps = playerScores[period][player];
        return (ps.hasEntered, ps.score, ps.pendingPrize, ps.claimed);
    }
    
    /**
     * @dev 🆕 Get total unclaimed prizes for a player across ALL periods
     */
    function getTotalUnclaimedPrizes(address player) external view returns (uint256) {
        uint256 total = 0;
        
        for (uint256 period = 1; period < currentPeriod; period++) {
            if (periods[period].distributed && 
                !playerScores[period][player].claimed && 
                playerScores[period][player].pendingPrize > 0) {
                total += playerScores[period][player].pendingPrize;
            }
        }
        
        return total;
    }
    
    /**
     * @dev 🆕 Get all unclaimed period numbers for a player
     */
    function getUnclaimedPeriods(address player) external view returns (uint256[] memory) {
        uint256[] memory tempPeriods = new uint256[](currentPeriod);
        uint256 count = 0;
        
        for (uint256 period = 1; period < currentPeriod; period++) {
            if (periods[period].distributed && 
                !playerScores[period][player].claimed && 
                playerScores[period][player].pendingPrize > 0) {
                tempPeriods[count] = period;
                count++;
            }
        }
        
        // Trim to actual size
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempPeriods[i];
        }
        
        return result;
    }
    
    function estimatePrize(uint256 score) external view returns (uint256) {
        if (periods[currentPeriod].totalPoints == 0 || currentPrizePool == 0) {
            return 0;
        }
        
        uint256 hypotheticalTotal = periods[currentPeriod].totalPoints + score;
        return (score * currentPrizePool) / hypotheticalTotal;
    }
    
    function getPlayerRank(address player, uint256 period) external view returns (uint256) {
        uint256 playerScore = playerScores[period][player].score;
        if (playerScore == 0) return 0;
        
        address[] memory players = periodPlayers[period];
        uint256 rank = 1;
        
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] != player && playerScores[period][players[i]].score > playerScore) {
                rank++;
            }
        }
        
        return rank;
    }
    
    function getTopPlayers(uint256 period, uint256 count) external view returns (
        address[] memory players,
        uint256[] memory scores,
        uint256[] memory prizes
    ) {
        address[] memory allPlayers = periodPlayers[period];
        uint256 total = allPlayers.length < count ? allPlayers.length : count;
        
        players = new address[](total);
        scores = new uint256[](total);
        prizes = new uint256[](total);
        
        for (uint256 i = 0; i < total; i++) {
            uint256 maxScore = 0;
            uint256 maxIndex = 0;
            
            for (uint256 j = 0; j < allPlayers.length; j++) {
                uint256 score = playerScores[period][allPlayers[j]].score;
                if (score > maxScore) {
                    bool alreadySelected = false;
                    for (uint256 k = 0; k < i; k++) {
                        if (players[k] == allPlayers[j]) {
                            alreadySelected = true;
                            break;
                        }
                    }
                    if (!alreadySelected) {
                        maxScore = score;
                        maxIndex = j;
                    }
                }
            }
            
            if (maxScore > 0) {
                players[i] = allPlayers[maxIndex];
                scores[i] = maxScore;
                prizes[i] = playerScores[period][allPlayers[maxIndex]].pendingPrize;
            }
        }
        
        return (players, scores, prizes);
    }
    
    function canAllocate() external view returns (bool) {
        return block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL &&
               !periods[currentPeriod].distributed &&
               currentPrizePool > 0;
    }
    
    function timeUntilAllocation() external view returns (uint256) {
        uint256 nextTime = lastDistributionTime + DISTRIBUTION_INTERVAL;
        if (block.timestamp >= nextTime) return 0;
        return nextTime - block.timestamp;
    }
    
    function hasEnteredCurrentPeriod(address player) external view returns (bool) {
        return playerScores[currentPeriod][player].hasEntered;
    }
    
    function getPendingPrize(address player, uint256 period) external view returns (uint256) {
        if (playerScores[period][player].claimed) return 0;
        return playerScores[period][player].pendingPrize;
    }
    
    function canClaim(address player, uint256 period) external view returns (bool) {
        return periods[period].distributed &&
               !playerScores[period][player].claimed &&
               playerScores[period][player].pendingPrize > 0;
    }
    
    function getPlatformBalance() external view returns (uint256) {
        return platformBalance;
    }
    
    function getPeriodPlayerCount(uint256 period) external view returns (uint256) {
        return periodPlayers[period].length;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    receive() external payable {}
}
