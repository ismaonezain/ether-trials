// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AnimeRPGPrizePoolWithClaim
 * @dev Smart contract dengan MANUAL CLAIM system
 * Deploy contract baru ini untuk enable manual claim prizes
 * Base Network (chainId: 8453)
 */
contract AnimeRPGPrizePoolWithClaim {
    address public owner;
    uint256 public constant ENTRY_FEE = 0.00001 ether;
    uint256 public constant DISTRIBUTION_INTERVAL = 24 hours;
    
    uint256 public currentPrizePool;
    uint256 public lastDistributionTime;
    uint256 public totalParticipants;
    uint256 public currentPeriod;
    
    // Mapping untuk track entry dan prizes
    mapping(address => uint256) public lastEntryPeriod;
    mapping(address => uint256) public pendingPrizes;
    mapping(address => uint256) public totalWinnings;
    mapping(address => bool) public hasClaimedCurrentPeriod;
    
    // Track all participants for each period
    address[] public participants;
    mapping(address => bool) public isParticipant;
    
    // Events
    event EntryFeePaid(address indexed player, uint256 amount, uint256 period);
    event PrizesAllocated(uint256 totalAmount, uint256 period, uint256 participantCount);
    event PrizeAllocated(address indexed player, uint256 amount, uint256 rank);
    event PrizeClaimed(address indexed player, uint256 amount);
    
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
     */
    function payEntryFee() external payable {
        require(msg.value == ENTRY_FEE, "Incorrect entry fee amount");
        require(lastEntryPeriod[msg.sender] < currentPeriod, "Already entered this period");
        
        currentPrizePool += msg.value;
        totalParticipants++;
        lastEntryPeriod[msg.sender] = currentPeriod;
        
        if (!isParticipant[msg.sender]) {
            participants.push(msg.sender);
            isParticipant[msg.sender] = true;
        }
        
        emit EntryFeePaid(msg.sender, msg.value, currentPeriod);
    }
    
    /**
     * @dev Allocate prizes ke top players (TIDAK AUTO SEND, tapi allocate untuk claim)
     * @param topPlayers Array of player addresses sorted by rank (index 0 = rank 1)
     */
    function allocatePrizes(address[] calldata topPlayers) external onlyOwner {
        require(block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL, "Distribution interval not reached");
        require(currentPrizePool > 0, "No prize pool to allocate");
        require(topPlayers.length > 0, "No players to allocate to");
        
        uint256 poolToDistribute = currentPrizePool;
        
        // Calculate amounts for each tier
        uint256 top10Pool = (poolToDistribute * 40) / 100;
        uint256 top100Pool = (poolToDistribute * 35) / 100;
        uint256 top1000Pool = (poolToDistribute * 25) / 100;
        
        uint256 playersCount = topPlayers.length;
        
        // Allocate to Top 10
        uint256 top10Count = playersCount > 10 ? 10 : playersCount;
        if (top10Count > 0) {
            uint256 amountPerTop10 = top10Pool / top10Count;
            for (uint256 i = 0; i < top10Count; i++) {
                _allocatePrize(topPlayers[i], amountPerTop10, i + 1);
            }
        }
        
        // Allocate to Top 11-100
        if (playersCount > 10) {
            uint256 top100Count = playersCount > 100 ? 90 : playersCount - 10;
            uint256 amountPerTop100 = top100Pool / top100Count;
            for (uint256 i = 10; i < 10 + top100Count; i++) {
                _allocatePrize(topPlayers[i], amountPerTop100, i + 1);
            }
        }
        
        // Allocate to Top 101-1000
        if (playersCount > 100) {
            uint256 top1000Count = playersCount > 1000 ? 900 : playersCount - 100;
            uint256 amountPerTop1000 = top1000Pool / top1000Count;
            for (uint256 i = 100; i < 100 + top1000Count; i++) {
                _allocatePrize(topPlayers[i], amountPerTop1000, i + 1);
            }
        }
        
        emit PrizesAllocated(poolToDistribute, currentPeriod, playersCount);
        
        // Reset untuk periode berikutnya
        currentPrizePool = 0;
        totalParticipants = 0;
        lastDistributionTime = block.timestamp;
        currentPeriod++;
        
        // Reset claim status untuk period baru
        for (uint256 i = 0; i < topPlayers.length; i++) {
            hasClaimedCurrentPeriod[topPlayers[i]] = false;
        }
    }
    
    /**
     * @dev Internal function untuk allocate prize (bukan send)
     */
    function _allocatePrize(address player, uint256 amount, uint256 rank) internal {
        if (amount > 0 && player != address(0)) {
            pendingPrizes[player] += amount;
            totalWinnings[player] += amount;
            emit PrizeAllocated(player, amount, rank);
        }
    }
    
    /**
     * @dev Player claim prize mereka sendiri
     */
    function claimPrize() external {
        uint256 amount = pendingPrizes[msg.sender];
        require(amount > 0, "No prize to claim");
        require(!hasClaimedCurrentPeriod[msg.sender], "Already claimed this period");
        
        pendingPrizes[msg.sender] = 0;
        hasClaimedCurrentPeriod[msg.sender] = true;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Prize transfer failed");
        
        emit PrizeClaimed(msg.sender, amount);
    }
    
    /**
     * @dev Check apakah player punya pending prize
     */
    function hasPendingPrize(address player) external view returns (bool) {
        return pendingPrizes[player] > 0 && !hasClaimedCurrentPeriod[player];
    }
    
    /**
     * @dev Get pending prize amount untuk player
     */
    function getPendingPrize(address player) external view returns (uint256) {
        if (hasClaimedCurrentPeriod[player]) {
            return 0;
        }
        return pendingPrizes[player];
    }
    
    /**
     * @dev Check apakah sudah waktunya untuk distribute
     */
    function canDistribute() external view returns (bool) {
        return block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL;
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
     * @dev Get current prize pool info
     */
    function getPrizePoolInfo() external view returns (
        uint256 pool,
        uint256 participants,
        uint256 lastDistribution,
        uint256 nextDistribution,
        uint256 period
    ) {
        return (
            currentPrizePool,
            totalParticipants,
            lastDistributionTime,
            lastDistributionTime + DISTRIBUTION_INTERVAL,
            currentPeriod
        );
    }
    
    /**
     * @dev Get player info
     */
    function getPlayerInfo(address player) external view returns (
        bool hasEntered,
        uint256 pending,
        uint256 total,
        bool hasClaimed
    ) {
        return (
            lastEntryPeriod[player] == currentPeriod,
            pendingPrizes[player],
            totalWinnings[player],
            hasClaimedCurrentPeriod[player]
        );
    }
    
    /**
     * @dev Emergency withdraw oleh owner
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
    
    receive() external payable {}
}
