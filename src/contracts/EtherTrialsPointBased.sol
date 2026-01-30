konto
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrialsPointBased
 * @dev Point-based linear reward system - fair & competitive
 * 
 * HOW IT WORKS:
 * - Entry Fee: 0.00002 ETH (50% prize + 50% platform)
 * - Rewards distributed LINEARLY based on player scores
 * - Higher score = Higher reward (proportional to total points)
 * - Manual claim system for gas optimization
 * - 24h distribution periods
 * 
 * Deploy to Base Network (chainId: 8453)
 */
contract EtherTrialsPointBased {
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
    mapping(uint256 => address[]) public periodPlayers; // Track all players in period
    
    // Events
    event EntryFeePaid(address indexed player, uint256 amount, uint256 period, uint256 timestamp);
    event ScoreSubmitted(address indexed player, uint256 score, uint256 period, uint256 timestamp);
    event PrizesAllocated(uint256 period, uint256 totalAmount, uint256 totalPoints, uint256 participantCount, uint256 timestamp);
    event PrizeClaimed(address indexed player, uint256 period, uint256 amount, uint256 timestamp);
    event PlatformFeesWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        lastDistributionTime = block.timestamp;
        currentPeriod = 1;
        
        // Initialize first period
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
        
        // Split fee
        currentPrizePool += PRIZE_CONTRIBUTION;
        platformBalance += PLATFORM_FEE;
        
        // Mark player as entered
        playerScores[currentPeriod][msg.sender].hasEntered = true;
        totalParticipantsCurrentPeriod++;
        
        // Add to period players list
        periodPlayers[currentPeriod].push(msg.sender);
        
        emit EntryFeePaid(msg.sender, msg.value, currentPeriod, block.timestamp);
    }
    
    /**
     * @dev Submit player score (called by backend/oracle)
     * Only owner can submit scores to prevent cheating
     */
    function submitScore(address player, uint256 score) external onlyOwner {
        require(playerScores[currentPeriod][player].hasEntered, "Player not entered");
        require(!periods[currentPeriod].distributed, "Period already distributed");
        
        // Update player score (only if higher than current)
        if (score > playerScores[currentPeriod][player].score) {
            // Remove old score from total
            periods[currentPeriod].totalPoints -= playerScores[currentPeriod][player].score;
            
            // Add new score
            playerScores[currentPeriod][player].score = score;
            periods[currentPeriod].totalPoints += score;
            
            emit ScoreSubmitted(player, score, currentPeriod, block.timestamp);
        }
    }
    
    /**
     * @dev Submit multiple scores in batch (gas optimization)
     */
    function submitScoresBatch(address[] calldata players, uint256[] calldata scores) external onlyOwner {
        require(players.length == scores.length, "Arrays length mismatch");
        require(!periods[currentPeriod].distributed, "Period already distributed");
        
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint256 score = scores[i];
            
            if (playerScores[currentPeriod][player].hasEntered && score > playerScores[currentPeriod][player].score) {
                // Remove old score from total
                periods[currentPeriod].totalPoints -= playerScores[currentPeriod][player].score;
                
                // Add new score
                playerScores[currentPeriod][player].score = score;
                periods[currentPeriod].totalPoints += score;
                
                emit ScoreSubmitted(player, score, currentPeriod, block.timestamp);
            }
        }
    }
    
    /**
     * @dev Allocate prizes based on linear point distribution
     * Each player gets: (playerScore / totalPoints) * prizePool
     */
    function allocatePrizes() external onlyOwner {
        require(block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL, "Distribution interval not reached");
        require(!periods[currentPeriod].distributed, "Period already distributed");
        require(currentPrizePool > 0, "No prize pool");
        require(periods[currentPeriod].totalPoints > 0, "No scores submitted");
        
        uint256 poolToDistribute = currentPrizePool;
        uint256 totalPoints = periods[currentPeriod].totalPoints;
        
        // Calculate prizes for all players based on their score proportion
        address[] memory players = periodPlayers[currentPeriod];
        uint256 allocatedTotal = 0;
        
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint256 score = playerScores[currentPeriod][player].score;
            
            if (score > 0) {
                // Linear calculation: (score / totalPoints) * poolToDistribute
                uint256 prize = (score * poolToDistribute) / totalPoints;
                
                if (prize > 0) {
                    playerScores[currentPeriod][player].pendingPrize = prize;
                    allocatedTotal += prize;
                }
            }
        }
        
        // Update period data
        periods[currentPeriod].prizePool = poolToDistribute;
        periods[currentPeriod].participantCount = totalParticipantsCurrentPeriod;
        periods[currentPeriod].distributed = true;
        
        emit PrizesAllocated(currentPeriod, poolToDistribute, totalPoints, players.length, block.timestamp);
        
        // Move to next period
        currentPrizePool = 0;
        totalParticipantsCurrentPeriod = 0;
        lastDistributionTime = block.timestamp;
        currentPeriod++;
        
        // Initialize next period
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
     * @dev Player claims their prize
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
    
    /**
     * @dev Get current period info
     */
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
    
    /**
     * @dev Get period info by period number
     */
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
    
    /**
     * @dev Get player info for specific period
     */
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
     * @dev Calculate estimated prize for a score
     */
    function estimatePrize(uint256 score) external view returns (uint256) {
        if (periods[currentPeriod].totalPoints == 0 || currentPrizePool == 0) {
            return 0;
        }
        
        uint256 hypotheticalTotal = periods[currentPeriod].totalPoints + score;
        return (score * currentPrizePool) / hypotheticalTotal;
    }
    
    /**
     * @dev Get player's rank in period (1-indexed, 1 = highest score)
     */
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
    
    /**
     * @dev Get top N players by score for a period
     */
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
        
        // Simple bubble sort for top N (good enough for reasonable N)
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
    
    /**
     * @dev Check if can allocate prizes
     */
    function canAllocate() external view returns (bool) {
        return block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL &&
               !periods[currentPeriod].distributed &&
               currentPrizePool > 0;
    }
    
    /**
     * @dev Time until next allocation
     */
    function timeUntilAllocation() external view returns (uint256) {
        uint256 nextTime = lastDistributionTime + DISTRIBUTION_INTERVAL;
        if (block.timestamp >= nextTime) return 0;
        return nextTime - block.timestamp;
    }
    
    /**
     * @dev Check if player has entered current period
     */
    function hasEnteredCurrentPeriod(address player) external view returns (bool) {
        return playerScores[currentPeriod][player].hasEntered;
    }
    
    /**
     * @dev Get pending prize for player in period
     */
    function getPendingPrize(address player, uint256 period) external view returns (uint256) {
        if (playerScores[period][player].claimed) return 0;
        return playerScores[period][player].pendingPrize;
    }
    
    /**
     * @dev Check if player can claim
     */
    function canClaim(address player, uint256 period) external view returns (bool) {
        return periods[period].distributed &&
               !playerScores[period][player].claimed &&
               playerScores[period][player].pendingPrize > 0;
    }
    
    /**
     * @dev Get platform balance
     */
    function getPlatformBalance() external view returns (uint256) {
        return platformBalance;
    }
    
    /**
     * @dev Get total players in period
     */
    function getPeriodPlayerCount(uint256 period) external view returns (uint256) {
        return periodPlayers[period].length;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Emergency withdraw (only if something goes wrong)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    receive() external payable {}
}
