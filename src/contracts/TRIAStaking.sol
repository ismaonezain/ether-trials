// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * ████████╗██████╗ ██╗ █████╗     ███████╗████████╗ █████╗ ██╗  ██╗██╗███╗   ██╗ ██████╗ 
 * ╚══██╔══╝██╔══██╗██║██╔══██╗    ██╔════╝╚══██╔══╝██╔══██╗██║ ██╔╝██║████╗  ██║██╔════╝ 
 *    ██║   ██████╔╝██║███████║    ███████╗   ██║   ███████║█████╔╝ ██║██╔██╗ ██║██║  ███╗
 *    ██║   ██╔══██╗██║██╔══██║    ╚════██║   ██║   ██╔══██║██╔═██╗ ██║██║╚██╗██║██║   ██║
 *    ██║   ██║  ██║██║██║  ██║    ███████║   ██║   ██║  ██║██║  ██╗██║██║ ╚████║╚██████╔╝
 *    ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝    ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ 
 * 
 * TRIAStaking - Flexible Staking with Rewards
 * 
 * NETWORK: Base Mainnet (Chain ID: 8453)
 * TOKEN: TRIA (0xD852713dD8dDF61316DA19383D0c427aDb85EB07)
 * 
 * FEATURES:
 * ✅ Flexible APY (10-20%, adjustable by owner)
 * ✅ 7-day unstaking cooldown
 * ✅ Rewards calculated per second
 * ✅ Claim rewards anytime
 * ✅ Emergency withdraw (owner only)
 * ✅ Pause/unpause staking
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TRIAStaking {
    // ========== STATE VARIABLES ==========
    address public owner;
    address public constant TRIA_TOKEN = 0xD852713dD8dDF61316DA19383D0c427aDb85EB07;
    
    uint256 public minAPY = 10; // 10% minimum APY
    uint256 public maxAPY = 20; // 20% maximum APY
    uint256 public currentAPY = 15; // Default 15% APY
    
    uint256 public constant UNSTAKE_COOLDOWN = 7 days; // 7 days cooldown
    uint256 public constant APY_PRECISION = 10000; // For percentage calculations (100.00%)
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    uint256 public totalStaked;
    uint256 public totalRewardsPaid;
    uint256 public rewardPool; // Owner deposits TRIA here for rewards
    
    bool public paused;
    
    struct StakeInfo {
        uint256 amount;
        uint256 rewardDebt; // Rewards already claimed
        uint256 lastClaimTime;
        uint256 unstakeRequestTime; // When user requested unstake
        bool unstakeRequested;
    }
    
    mapping(address => StakeInfo) public stakes;
    address[] public stakers;
    mapping(address => bool) public isStaker;
    
    // ========== EVENTS ==========
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event UnstakeRequested(address indexed user, uint256 amount, uint256 unlockTime);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event APYUpdated(uint256 oldAPY, uint256 newAPY);
    event RewardPoolDeposited(uint256 amount, uint256 timestamp);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event PauseToggled(bool isPaused);
    
    // ========== MODIFIERS ==========
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Staking paused");
        _;
    }
    
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANT");
        _locked = 2;
        _;
        _locked = 1;
    }
    
    // ========== CONSTRUCTOR ==========
    constructor() {
        owner = msg.sender;
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @dev Set APY (between 10-20%)
     */
    function setAPY(uint256 newAPY) external onlyOwner {
        require(newAPY >= minAPY && newAPY <= maxAPY, "APY must be between 10-20%");
        uint256 oldAPY = currentAPY;
        currentAPY = newAPY;
        emit APYUpdated(oldAPY, newAPY);
    }
    
    /**
     * @dev Deposit TRIA to reward pool
     */
    function depositRewardPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be positive");
        require(
            IERC20(TRIA_TOKEN).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        rewardPool += amount;
        emit RewardPoolDeposited(amount, block.timestamp);
    }
    
    /**
     * @dev Emergency withdraw (only unstaked funds, not user stakes)
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 available = IERC20(TRIA_TOKEN).balanceOf(address(this)) - totalStaked;
        require(amount <= available, "Cannot withdraw user stakes");
        require(IERC20(TRIA_TOKEN).transfer(to, amount), "Transfer failed");
        if (amount <= rewardPool) {
            rewardPool -= amount;
        }
        emit EmergencyWithdraw(to, amount);
    }
    
    /**
     * @dev Pause/unpause staking
     */
    function togglePause() external onlyOwner {
        paused = !paused;
        emit PauseToggled(paused);
    }
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    // ========== USER FUNCTIONS ==========
    
    /**
     * @dev Stake TRIA tokens
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be positive");
        
        StakeInfo storage userStake = stakes[msg.sender];
        
        // Claim pending rewards first
        if (userStake.amount > 0) {
            _claimRewards(msg.sender);
        }
        
        // Transfer TRIA from user
        require(
            IERC20(TRIA_TOKEN).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        // Update stake
        userStake.amount += amount;
        userStake.lastClaimTime = block.timestamp;
        userStake.unstakeRequested = false; // Reset unstake request
        userStake.unstakeRequestTime = 0;
        
        totalStaked += amount;
        
        // Add to stakers list if new staker
        if (!isStaker[msg.sender]) {
            stakers.push(msg.sender);
            isStaker[msg.sender] = true;
        }
        
        emit Staked(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev Request unstake (starts cooldown)
     */
    function requestUnstake() external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");
        require(!userStake.unstakeRequested, "Unstake already requested");
        
        // Claim pending rewards before unstaking
        _claimRewards(msg.sender);
        
        userStake.unstakeRequested = true;
        userStake.unstakeRequestTime = block.timestamp;
        
        uint256 unlockTime = block.timestamp + UNSTAKE_COOLDOWN;
        emit UnstakeRequested(msg.sender, userStake.amount, unlockTime);
    }
    
    /**
     * @dev Unstake TRIA tokens (after cooldown)
     */
    function unstake() external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");
        require(userStake.unstakeRequested, "Must request unstake first");
        require(
            block.timestamp >= userStake.unstakeRequestTime + UNSTAKE_COOLDOWN,
            "Cooldown not finished"
        );
        
        uint256 amount = userStake.amount;
        
        // Claim any remaining rewards
        _claimRewards(msg.sender);
        
        // Reset stake
        userStake.amount = 0;
        userStake.unstakeRequested = false;
        userStake.unstakeRequestTime = 0;
        
        totalStaked -= amount;
        
        // Transfer TRIA back to user
        require(IERC20(TRIA_TOKEN).transfer(msg.sender, amount), "Transfer failed");
        
        emit Unstaked(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev Cancel unstake request
     */
    function cancelUnstake() external {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.unstakeRequested, "No unstake request found");
        
        userStake.unstakeRequested = false;
        userStake.unstakeRequestTime = 0;
    }
    
    /**
     * @dev Claim rewards
     */
    function claimRewards() external nonReentrant {
        _claimRewards(msg.sender);
    }
    
    /**
     * @dev Internal claim rewards function
     */
    function _claimRewards(address user) internal {
        StakeInfo storage userStake = stakes[user];
        require(userStake.amount > 0, "No stake found");
        
        uint256 pending = calculatePendingRewards(user);
        
        if (pending > 0) {
            require(pending <= rewardPool, "Insufficient reward pool");
            
            userStake.rewardDebt += pending;
            userStake.lastClaimTime = block.timestamp;
            
            rewardPool -= pending;
            totalRewardsPaid += pending;
            
            require(IERC20(TRIA_TOKEN).transfer(user, pending), "Transfer failed");
            
            emit RewardsClaimed(user, pending, block.timestamp);
        }
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @dev Calculate pending rewards for user
     * Formula: (stake * APY * time) / (SECONDS_PER_YEAR * 100)
     */
    function calculatePendingRewards(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        
        if (userStake.amount == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - userStake.lastClaimTime;
        
        // Calculate rewards: (amount * APY * timeElapsed) / (SECONDS_PER_YEAR * 100)
        uint256 rewards = (userStake.amount * currentAPY * timeElapsed) / (SECONDS_PER_YEAR * 100);
        
        return rewards;
    }
    
    /**
     * @dev Get user stake info
     */
    function getUserStakeInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards,
        uint256 totalClaimedRewards,
        uint256 lastClaimTime,
        bool isUnstakeRequested,
        uint256 unstakeRequestTime,
        uint256 unlockTime,
        bool canUnstake
    ) {
        StakeInfo memory userStake = stakes[user];
        
        uint256 pending = calculatePendingRewards(user);
        uint256 unlock = userStake.unstakeRequested 
            ? userStake.unstakeRequestTime + UNSTAKE_COOLDOWN 
            : 0;
        bool canUnstakeNow = userStake.unstakeRequested && block.timestamp >= unlock;
        
        return (
            userStake.amount,
            pending,
            userStake.rewardDebt,
            userStake.lastClaimTime,
            userStake.unstakeRequested,
            userStake.unstakeRequestTime,
            unlock,
            canUnstakeNow
        );
    }
    
    /**
     * @dev Get contract info
     */
    function getContractInfo() external view returns (
        uint256 _totalStaked,
        uint256 _totalRewardsPaid,
        uint256 _rewardPool,
        uint256 _currentAPY,
        uint256 _minAPY,
        uint256 _maxAPY,
        uint256 _unstakeCooldown,
        bool _paused,
        uint256 _stakerCount
    ) {
        return (
            totalStaked,
            totalRewardsPaid,
            rewardPool,
            currentAPY,
            minAPY,
            maxAPY,
            UNSTAKE_COOLDOWN,
            paused,
            stakers.length
        );
    }
    
    /**
     * @dev Get all stakers
     */
    function getAllStakers() external view returns (address[] memory) {
        return stakers;
    }
    
    /**
     * @dev Estimate APY for amount
     */
    function estimateYearlyRewards(uint256 amount) external view returns (uint256) {
        return (amount * currentAPY) / 100;
    }
    
    function version() external pure returns (string memory) {
        return "v1.0.0-tria-staking";
    }
}
TRIAStaking.sol
