// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AnimeRPGPrizePoolV2
 * @dev Sustainable prize pool contract dengan manual claim system
 * Entry Fee: 0.00002 ETH (0.00001 prize + 0.00001 platform)
 * Deploy ke Base Network (chainId: 8453)
 */
contract AnimeRPGPrizePoolV2 {
    address public owner;
    uint256 public constant ENTRY_FEE = 0.00002 ether;
    uint256 public constant PLATFORM_FEE = 0.00001 ether; // 50% untuk owner
    uint256 public constant PRIZE_CONTRIBUTION = 0.00001 ether; // 50% untuk prize pool
    uint256 public constant DISTRIBUTION_INTERVAL = 24 hours;
    
    uint256 public currentPrizePool;
    uint256 public platformBalance; // Balance untuk owner
    uint256 public lastDistributionTime;
    uint256 public currentPeriod;
    uint256 public totalParticipantsCurrentPeriod;
    
    // Prize allocation per address
    mapping(uint256 => mapping(address => uint256)) public pendingPrizes; // period => player => amount
    mapping(uint256 => mapping(address => bool)) public hasClaimed; // period => player => claimed
    mapping(address => uint256) public lastEntryTime;
    mapping(uint256 => mapping(address => bool)) public hasEnteredPeriod; // period => player => entered
    
    // Period stats
    mapping(uint256 => uint256) public periodPrizePool;
    mapping(uint256 => uint256) public periodParticipants;
    mapping(uint256 => bool) public periodDistributed;
    
    // Events
    event EntryFeePaid(address indexed player, uint256 amount, uint256 period, uint256 timestamp);
    event PrizesAllocated(uint256 period, uint256 totalAmount, uint256 timestamp, uint256 participantCount);
    event PrizeClaimed(address indexed player, uint256 period, uint256 amount, uint256 timestamp);
    event PlatformFeesWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        lastDistributionTime = block.timestamp;
        currentPeriod = 1;
    }
    
    /**
     * @dev Player bayar entry fee untuk ikut game
     * 0.00002 ETH = 0.00001 prize pool + 0.00001 platform fee
     */
    function payEntryFee() external payable {
        require(msg.value == ENTRY_FEE, "Incorrect entry fee amount");
        require(!hasEnteredPeriod[currentPeriod][msg.sender], "Already entered this period");
        
        // Split fee
        currentPrizePool += PRIZE_CONTRIBUTION;
        platformBalance += PLATFORM_FEE;
        
        totalParticipantsCurrentPeriod++;
        lastEntryTime[msg.sender] = block.timestamp;
        hasEnteredPeriod[currentPeriod][msg.sender] = true;
        
        emit EntryFeePaid(msg.sender, msg.value, currentPeriod, block.timestamp);
    }
    
    /**
     * @dev Allocate prizes ke top players berdasarkan leaderboard (manual claim)
     * @param topPlayers Array of player addresses sorted by rank
     * @param distribution Distribution percentages (basis points, e.g., 4000 = 40%)
     * 
     * Default distribution:
     * - Top 10 (rank 1-10): 40% of pool (4000 basis points)
     * - Top 11-100: 35% of pool (3500 basis points)
     * - Top 101-1000: 25% of pool (2500 basis points)
     */
    function allocatePrizes(
        address[] calldata topPlayers,
        uint256[] calldata distribution
    ) external onlyOwner {
        require(block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL, "Distribution interval not reached");
        require(!periodDistributed[currentPeriod], "Period already distributed");
        require(currentPrizePool > 0, "No prize pool to distribute");
        require(topPlayers.length > 0, "No players to distribute to");
        require(distribution.length == 3, "Need 3 distribution values");
        require(distribution[0] + distribution[1] + distribution[2] == 10000, "Distribution must sum to 100%");
        
        uint256 poolToDistribute = currentPrizePool;
        
        // Calculate amounts for each tier (using basis points)
        uint256 top10Pool = (poolToDistribute * distribution[0]) / 10000;
        uint256 top100Pool = (poolToDistribute * distribution[1]) / 10000;
        uint256 top1000Pool = (poolToDistribute * distribution[2]) / 10000;
        
        uint256 playersCount = topPlayers.length;
        
        // Allocate to Top 10
        uint256 top10Count = playersCount > 10 ? 10 : playersCount;
        if (top10Count > 0 && top10Pool > 0) {
            uint256 amountPerTop10 = top10Pool / top10Count;
            for (uint256 i = 0; i < top10Count; i++) {
                pendingPrizes[currentPeriod][topPlayers[i]] = amountPerTop10;
            }
        }
        
        // Allocate to Top 11-100
        if (playersCount > 10) {
            uint256 top100Count = playersCount > 100 ? 90 : playersCount - 10;
            if (top100Count > 0 && top100Pool > 0) {
                uint256 amountPerTop100 = top100Pool / top100Count;
                for (uint256 i = 10; i < 10 + top100Count; i++) {
                    pendingPrizes[currentPeriod][topPlayers[i]] = amountPerTop100;
                }
            }
        }
        
        // Allocate to Top 101-1000
        if (playersCount > 100) {
            uint256 top1000Count = playersCount > 1000 ? 900 : playersCount - 100;
            if (top1000Count > 0 && top1000Pool > 0) {
                uint256 amountPerTop1000 = top1000Pool / top1000Count;
                for (uint256 i = 100; i < 100 + top1000Count; i++) {
                    pendingPrizes[currentPeriod][topPlayers[i]] = amountPerTop1000;
                }
            }
        }
        
        // Store period stats
        periodPrizePool[currentPeriod] = poolToDistribute;
        periodParticipants[currentPeriod] = totalParticipantsCurrentPeriod;
        periodDistributed[currentPeriod] = true;
        
        emit PrizesAllocated(currentPeriod, poolToDistribute, block.timestamp, playersCount);
        
        // Reset untuk periode berikutnya
        currentPrizePool = 0;
        totalParticipantsCurrentPeriod = 0;
        lastDistributionTime = block.timestamp;
        currentPeriod++;
    }
    
    /**
     * @dev Player claim prize mereka sendiri
     * @param period Tournament period untuk claim
     */
    function claimPrize(uint256 period) external {
        require(periodDistributed[period], "Period not yet distributed");
        require(!hasClaimed[period][msg.sender], "Already claimed");
        require(pendingPrizes[period][msg.sender] > 0, "No prize to claim");
        
        uint256 amount = pendingPrizes[period][msg.sender];
        hasClaimed[period][msg.sender] = true;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Prize transfer failed");
        
        emit PrizeClaimed(msg.sender, period, amount, block.timestamp);
    }
    
    /**
     * @dev Owner withdraw platform fees
     */
    function withdrawPlatformFees() external onlyOwner {
        require(platformBalance > 0, "No platform fees to withdraw");
        
        uint256 amount = platformBalance;
        platformBalance = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit PlatformFeesWithdrawn(owner, amount, block.timestamp);
    }
    
    /**
     * @dev Check pending prize untuk player di period tertentu
     */
    function getPendingPrize(address player, uint256 period) external view returns (uint256) {
        if (hasClaimed[period][player]) {
            return 0;
        }
        return pendingPrizes[period][player];
    }
    
    /**
     * @dev Check apakah player bisa claim
     */
    function canClaim(address player, uint256 period) external view returns (bool) {
        return periodDistributed[period] && 
               !hasClaimed[period][player] && 
               pendingPrizes[period][player] > 0;
    }
    
    /**
     * @dev Check apakah sudah waktunya untuk distribute
     */
    function canDistribute() external view returns (bool) {
        return block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL &&
               !periodDistributed[currentPeriod];
    }
    
    /**
     * @dev Get time until next distribution
     */
    function timeUntilDistribution() external view returns (uint256) {
        uint256 nextDistTime = lastDistributionTime + DISTRIBUTION_INTERVAL;
        if (block.timestamp >= nextDistTime) {
            return 0;
        }
        return nextDistTime - block.timestamp;
    }
    
    /**
     * @dev Get current prize pool info dengan breakdown
     */
    function getPrizePoolInfo() external view returns (
        uint256 currentPool,
        uint256 participants,
        uint256 platform,
        uint256 lastDistribution,
        uint256 nextDistribution,
        uint256 period,
        bool canDist
    ) {
        return (
            currentPrizePool,
            totalParticipantsCurrentPeriod,
            platformBalance,
            lastDistributionTime,
            lastDistributionTime + DISTRIBUTION_INTERVAL,
            currentPeriod,
            block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL
        );
    }
    
    /**
     * @dev Get period stats
     */
    function getPeriodStats(uint256 period) external view returns (
        uint256 prizePool,
        uint256 participants,
        bool distributed
    ) {
        return (
            periodPrizePool[period],
            periodParticipants[period],
            periodDistributed[period]
        );
    }
    
    /**
     * @dev Get player stats untuk period tertentu
     */
    function getPlayerStats(address player, uint256 period) external view returns (
        bool entered,
        uint256 pendingPrize,
        bool claimed
    ) {
        return (
            hasEnteredPeriod[period][player],
            pendingPrizes[period][player],
            hasClaimed[period][player]
        );
    }
    
    /**
     * @dev Emergency withdraw oleh owner (only if something goes wrong)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
    
    /**
     * @dev Fallback untuk receive ETH
     */
    receive() external payable {
        // Allow receiving ETH but don't count as entry fee
    }
}
