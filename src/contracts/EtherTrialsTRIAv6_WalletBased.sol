// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrials TRIA v6 - Wallet-Based (NO FID)
 * @notice Tournament with daily dice rolls & TRIA buyback - Secured by wallet addresses
 * @dev 3 free dice/day, then exponential pricing: 0.00001, 0.00002, 0.00004 ETH...
 */

interface IUniswapV2Router {
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    
    function WETH() external pure returns (address);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract EtherTrialsTRIAv6 {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    address public owner;
    address public immutable triaToken;
    IUniswapV2Router public immutable uniswapRouter;
    
    // Timing
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant SCORE_REVEAL_WINDOW = 10 minutes;
    
    // Entry limits
    uint256 public constant MIN_ENTRY = 0.00001 ether;
    uint256 public constant MAX_ENTRY = 1 ether;
    
    // Entry fee allocations (out of 100%)
    uint256 public constant PRIZE_POOL_ALLOCATION = 85;     // 85% to prize pool
    uint256 public constant BUYBACK_ALLOCATION = 10;        // 10% buyback $TRIA
    uint256 public constant TREASURY_ALLOCATION = 5;        // 5% treasury
    
    // Dice system
    uint256 public constant FREE_DICE_PER_DAY = 3;
    uint256 public constant DICE_BASE_PRICE = 0.00001 ether; // First paid dice
    uint256 public constant DICE_BUYBACK_PERCENT = 80;      // 80% buyback TRIA
    uint256 public constant DICE_TREASURY_PERCENT = 20;     // 20% treasury ETH
    
    // Slippage
    uint256 public constant MIN_SLIPPAGE_TOLERANCE = 98; // 2% slippage
    
    // Balances
    uint256 public buybackTRIABalance; // Admin can withdraw this
    uint256 public treasuryBalance;
    
    // Period tracking
    uint256 public currentPeriod;
    uint256 public immutable deploymentTime;
    
    // ============================================
    // STRUCTS
    // ============================================
    
    struct Period {
        uint256 startTime;
        uint256 endTime;
        uint256 triaPool;
        bool finalized;
        uint256 totalWeightedScore;
        uint256 participantCount;
    }
    
    struct Entry {
        uint256 entryAmountETH;
        uint256 entryWeight;
        uint256 timestamp;
        bool exists;
    }
    
    struct ScoreCommitment {
        bytes32 commitHash;
        uint256 commitTime;
        uint256 score;
        bool revealed;
    }
    
    struct ClaimStatus {
        bool claimed;
        uint256 triaAmount;
    }
    
    struct DiceUsage {
        uint8 freeRollsUsed;    // 0-3
        uint8 paidRollsUsed;    // Counts paid dice for exponential pricing
    }
    
    // ============================================
    // MAPPINGS (WALLET-BASED)
    // ============================================
    
    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(address => Entry)) public entries;
    mapping(uint256 => mapping(address => ScoreCommitment)) public scoreCommitments;
    mapping(uint256 => mapping(address => ClaimStatus)) public claimStatus;
    
    // Dice tracking: period => wallet => DiceUsage
    mapping(uint256 => mapping(address => DiceUsage)) public diceUsage;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event TournamentEntry(uint256 indexed period, address indexed user, uint256 ethAmount, uint256 triaReceived, uint256 weight);
    event ScoreCommitted(uint256 indexed period, address indexed user, bytes32 commitHash);
    event ScoreRevealed(uint256 indexed period, address indexed user, uint256 score);
    event PeriodFinalized(uint256 indexed period, uint256 triaPool, uint256 totalWeightedScore, uint256 participants);
    event RewardsClaimed(uint256 indexed period, address indexed user, uint256 triaAmount);
    event BuybackWithdrawn(address owner, uint256 triaAmount);
    event TreasuryWithdrawn(address owner, uint256 ethAmount);
    
    event DiceRolled(uint256 indexed period, address indexed user, bool wasFree, uint256 paidAmount, uint256 totalRolls);
    event DicePaymentProcessed(uint256 ethAmount, uint256 triaBought, uint256 treasuryETH);
    
    // ============================================
    // ERRORS
    // ============================================
    
    error Unauthorized();
    error InvalidAmount();
    error AlreadyEntered();
    error PeriodNotEnded();
    error PeriodAlreadyFinalized();
    error NoEntry();
    error AlreadyClaimed();
    error NoRewardsToClaim();
    error InsufficientBalance();
    error SwapFailed();
    error AlreadyCommitted();
    error NotCommitted();
    error RevealWindowExpired();
    error InvalidReveal();
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        address _triaToken,
        address _uniswapRouter
    ) {
        owner = msg.sender;
        triaToken = _triaToken;
        uniswapRouter = IUniswapV2Router(_uniswapRouter);
        deploymentTime = block.timestamp;
        
        // Initialize period 0
        currentPeriod = 0;
        periods[0].startTime = block.timestamp;
        periods[0].endTime = block.timestamp + PERIOD_DURATION;
        periods[0].finalized = false;
        periods[0].participantCount = 0;
    }
    
    // ============================================
    // TOURNAMENT ENTRY
    // ============================================
    
    function enterTournament() external payable {
        if (msg.value < MIN_ENTRY || msg.value > MAX_ENTRY) {
            revert InvalidAmount();
        }
        
        uint256 period = _getCurrentPeriod();
        if (entries[period][msg.sender].exists) {
            revert AlreadyEntered();
        }
        
        // Calculate allocations
        uint256 prizePoolETH = (msg.value * PRIZE_POOL_ALLOCATION) / 100;
        uint256 buybackETH = (msg.value * BUYBACK_ALLOCATION) / 100;
        uint256 treasuryETH = (msg.value * TREASURY_ALLOCATION) / 100;
        
        // Swap to TRIA (85% + 10%)
        uint256 swapAmount = prizePoolETH + buybackETH;
        uint256 triaReceived = _swapETHForTRIA(swapAmount);
        
        uint256 prizePoolTRIA = (triaReceived * PRIZE_POOL_ALLOCATION) / (PRIZE_POOL_ALLOCATION + BUYBACK_ALLOCATION);
        uint256 buybackTRIA = triaReceived - prizePoolTRIA;
        
        // Update balances
        periods[period].triaPool += prizePoolTRIA;
        buybackTRIABalance += buybackTRIA;
        treasuryBalance += treasuryETH;
        periods[period].participantCount++;
        
        // Calculate entry weight
        uint256 weight = (msg.value * 1e18) / MIN_ENTRY;
        
        entries[period][msg.sender] = Entry({
            entryAmountETH: msg.value,
            entryWeight: weight,
            timestamp: block.timestamp,
            exists: true
        });
        
        emit TournamentEntry(period, msg.sender, msg.value, prizePoolTRIA, weight);
    }
    
    // ============================================
    // DAILY DICE SYSTEM
    // ============================================
    
    /**
     * @notice Roll dice for bonus stats
     * @dev 3 free per day, then exponential pricing: 0.00001, 0.00002, 0.00004 ETH...
     */
    function rollDice() external payable {
        uint256 period = _getCurrentPeriod();
        
        // Check if user has entry
        if (!entries[period][msg.sender].exists) {
            revert NoEntry();
        }
        
        DiceUsage storage usage = diceUsage[period][msg.sender];
        
        // Check free dice first
        if (usage.freeRollsUsed < FREE_DICE_PER_DAY) {
            // FREE DICE
            if (msg.value != 0) {
                revert InvalidAmount();
            }
            
            usage.freeRollsUsed++;
            uint256 totalRolls = uint256(usage.freeRollsUsed) + uint256(usage.paidRollsUsed);
            
            emit DiceRolled(period, msg.sender, true, 0, totalRolls);
        } else {
            // PAID DICE - Exponential pricing: 0.00001 * (2 ^ paidRollsUsed)
            uint256 expectedPrice = DICE_BASE_PRICE * (2 ** usage.paidRollsUsed);
            
            if (msg.value != expectedPrice) {
                revert InvalidAmount();
            }
            
            // Process payment: 80% buyback TRIA, 20% treasury ETH
            uint256 buybackETH = (msg.value * DICE_BUYBACK_PERCENT) / 100;
            uint256 treasuryETH = msg.value - buybackETH;
            
            // Swap buyback portion to TRIA
            uint256 triaBought = _swapETHForTRIA(buybackETH);
            buybackTRIABalance += triaBought;
            treasuryBalance += treasuryETH;
            
            usage.paidRollsUsed++;
            uint256 totalRolls = uint256(usage.freeRollsUsed) + uint256(usage.paidRollsUsed);
            
            emit DiceRolled(period, msg.sender, false, msg.value, totalRolls);
            emit DicePaymentProcessed(msg.value, triaBought, treasuryETH);
        }
    }
    
    /**
     * @notice Get dice info for a user
     */
    function getDiceInfo(uint256 period, address user) external view returns (
        uint8 freeRollsUsed,
        uint8 freeRollsRemaining,
        uint8 paidRollsUsed,
        uint256 nextPaidPrice
    ) {
        DiceUsage storage usage = diceUsage[period][user];
        freeRollsUsed = usage.freeRollsUsed;
        freeRollsRemaining = uint8(FREE_DICE_PER_DAY) - usage.freeRollsUsed;
        paidRollsUsed = usage.paidRollsUsed;
        
        // Calculate next paid price
        if (freeRollsRemaining > 0) {
            nextPaidPrice = 0; // Next roll is free
        } else {
            nextPaidPrice = DICE_BASE_PRICE * (2 ** usage.paidRollsUsed);
        }
        
        return (freeRollsUsed, freeRollsRemaining, paidRollsUsed, nextPaidPrice);
    }
    
    // ============================================
    // SCORE COMMITMENT
    // ============================================
    
    function commitScore(uint256 period, bytes32 commitHash) external {
        if (!entries[period][msg.sender].exists) {
            revert NoEntry();
        }
        
        if (scoreCommitments[period][msg.sender].commitHash != bytes32(0)) {
            revert AlreadyCommitted();
        }
        
        scoreCommitments[period][msg.sender] = ScoreCommitment({
            commitHash: commitHash,
            commitTime: block.timestamp,
            score: 0,
            revealed: false
        });
        
        emit ScoreCommitted(period, msg.sender, commitHash);
    }
    
    function revealScore(
        uint256 period,
        uint256 score,
        uint256 nonce,
        uint256 timestamp
    ) external {
        ScoreCommitment storage commitment = scoreCommitments[period][msg.sender];
        
        if (commitment.commitHash == bytes32(0)) {
            revert NotCommitted();
        }
        
        if (commitment.revealed) {
            revert AlreadyCommitted();
        }
        
        if (block.timestamp > commitment.commitTime + SCORE_REVEAL_WINDOW) {
            revert RevealWindowExpired();
        }
        
        // Verify hash (uses wallet address instead of FID)
        bytes32 revealHash = keccak256(abi.encodePacked(msg.sender, score, nonce, timestamp));
        if (revealHash != commitment.commitHash) {
            revert InvalidReveal();
        }
        
        // Update score
        commitment.score = score;
        commitment.revealed = true;
        
        uint256 weight = entries[period][msg.sender].entryWeight;
        periods[period].totalWeightedScore += (score * weight) / 1e18;
        
        emit ScoreRevealed(period, msg.sender, score);
    }
    
    // ============================================
    // PERIOD MANAGEMENT
    // ============================================
    
    function finalizePeriod(uint256 period) external {
        if (periods[period].finalized) {
            revert PeriodAlreadyFinalized();
        }
        
        if (block.timestamp < periods[period].endTime) {
            revert PeriodNotEnded();
        }
        
        periods[period].finalized = true;
        
        // Start new period if finalizing current
        if (period == currentPeriod) {
            currentPeriod++;
            periods[currentPeriod].startTime = block.timestamp;
            periods[currentPeriod].endTime = block.timestamp + PERIOD_DURATION;
            periods[currentPeriod].finalized = false;
            periods[currentPeriod].participantCount = 0;
        }
        
        emit PeriodFinalized(period, periods[period].triaPool, periods[period].totalWeightedScore, periods[period].participantCount);
    }
    
    // ============================================
    // CLAIM REWARDS
    // ============================================
    
    function claimAllRewards() external {
        uint256 totalTRIA = 0;
        
        for (uint256 period = 0; period <= currentPeriod; period++) {
            if (!periods[period].finalized) continue;
            if (!entries[period][msg.sender].exists) continue;
            if (!scoreCommitments[period][msg.sender].revealed) continue;
            if (claimStatus[period][msg.sender].claimed) continue;
            
            uint256 reward = _calculateReward(period, msg.sender);
            
            if (reward > 0) {
                claimStatus[period][msg.sender].claimed = true;
                claimStatus[period][msg.sender].triaAmount = reward;
                totalTRIA += reward;
            }
        }
        
        if (totalTRIA == 0) {
            revert NoRewardsToClaim();
        }
        
        bool success = IERC20(triaToken).transfer(msg.sender, totalTRIA);
        if (!success) revert InsufficientBalance();
        
        emit RewardsClaimed(currentPeriod, msg.sender, totalTRIA);
    }
    
    // ============================================
    // OWNER FUNCTIONS
    // ============================================
    
    /**
     * @notice Admin withdraws TRIA from buyback pool
     * @dev Buyback TRIA comes from entry fees (10%) + dice payments (80%)
     */
    function withdrawBuyback() external onlyOwner {
        uint256 amount = buybackTRIABalance;
        if (amount == 0) revert InsufficientBalance();
        
        buybackTRIABalance = 0;
        
        bool success = IERC20(triaToken).transfer(owner, amount);
        if (!success) revert InsufficientBalance();
        
        emit BuybackWithdrawn(owner, amount);
    }
    
    function withdrawTreasury() external onlyOwner {
        uint256 amount = treasuryBalance;
        if (amount == 0) revert InsufficientBalance();
        
        treasuryBalance = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert InsufficientBalance();
        
        emit TreasuryWithdrawn(owner, amount);
    }
    
    function injectTRIAToPrizePool(uint256 amount) external onlyOwner {
        if (amount > buybackTRIABalance) revert InsufficientBalance();
        
        buybackTRIABalance -= amount;
        periods[currentPeriod].triaPool += amount;
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
    
    function emergencyWithdrawETH() external onlyOwner {
        (bool success, ) = payable(owner).call{value: address(this).balance}("");
        if (!success) revert InsufficientBalance();
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    function getCurrentPeriod() external view returns (uint256) {
        return _getCurrentPeriod();
    }
    
    function calculateReward(uint256 period, address user) external view returns (uint256) {
        return _calculateReward(period, user);
    }
    
    function getClaimableRewards(address user) external view returns (uint256 totalTRIA) {
        for (uint256 period = 0; period <= currentPeriod; period++) {
            if (!periods[period].finalized) continue;
            if (!entries[period][user].exists) continue;
            if (!scoreCommitments[period][user].revealed) continue;
            if (claimStatus[period][user].claimed) continue;
            
            totalTRIA += _calculateReward(period, user);
        }
    }
    
    function getPeriodInfo(uint256 period) external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 triaPool,
        bool finalized,
        uint256 totalWeightedScore,
        uint256 participantCount,
        uint256 timeRemaining,
        string memory status
    ) {
        Period storage p = periods[period];
        
        uint256 currentTime = block.timestamp;
        uint256 remaining = 0;
        if (currentTime < p.endTime) {
            remaining = p.endTime - currentTime;
        }
        
        string memory statusStr;
        if (p.finalized) {
            statusStr = "finalized";
        } else if (currentTime < p.startTime) {
            statusStr = "not-started";
        } else if (currentTime >= p.startTime && currentTime < p.endTime) {
            statusStr = "active";
        } else {
            statusStr = "ended";
        }
        
        return (
            p.startTime,
            p.endTime,
            p.triaPool,
            p.finalized,
            p.totalWeightedScore,
            p.participantCount,
            remaining,
            statusStr
        );
    }
    
    function getUserEntry(uint256 period, address user) external view returns (
        bool exists,
        uint256 entryAmountETH,
        uint256 entryWeight
    ) {
        Entry storage entry = entries[period][user];
        return (
            entry.exists,
            entry.entryAmountETH,
            entry.entryWeight
        );
    }
    
    function getUserCommitment(uint256 period, address user) external view returns (
        bool hasCommitted,
        bool hasRevealed,
        uint256 score
    ) {
        ScoreCommitment storage commitment = scoreCommitments[period][user];
        return (
            commitment.commitHash != bytes32(0),
            commitment.revealed,
            commitment.score
        );
    }
    
    function getUserClaim(uint256 period, address user) external view returns (
        bool hasClaimed,
        uint256 claimedAmount,
        uint256 pendingReward
    ) {
        ClaimStatus storage claim = claimStatus[period][user];
        return (
            claim.claimed,
            claim.triaAmount,
            _calculateReward(period, user)
        );
    }
    
    function getBalances() external view returns (
        uint256 buybackTRIA,
        uint256 treasury
    ) {
        return (buybackTRIABalance, treasuryBalance);
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    function _getCurrentPeriod() internal view returns (uint256) {
        if (block.timestamp < periods[currentPeriod].endTime) {
            return currentPeriod;
        }
        return currentPeriod + 1;
    }
    
    function _swapETHForTRIA(uint256 ethAmount) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = triaToken;
        
        uint256 minOutput = (ethAmount * MIN_SLIPPAGE_TOLERANCE) / 100;
        
        try uniswapRouter.swapExactETHForTokens{value: ethAmount}(
            minOutput,
            path,
            address(this),
            block.timestamp + 300
        ) returns (uint256[] memory amounts) {
            return amounts[1];
        } catch {
            revert SwapFailed();
        }
    }
    
    function _calculateReward(uint256 period, address user) internal view returns (uint256) {
        if (!entries[period][user].exists) return 0;
        if (!periods[period].finalized) return 0;
        if (!scoreCommitments[period][user].revealed) return 0;
        
        uint256 score = scoreCommitments[period][user].score;
        if (score == 0) return 0;
        
        uint256 weight = entries[period][user].entryWeight;
        uint256 weightedScore = (score * weight) / 1e18;
        
        uint256 totalWeighted = periods[period].totalWeightedScore;
        if (totalWeighted == 0) return 0;
        
        uint256 prizePool = periods[period].triaPool;
        
        return (weightedScore * prizePool) / totalWeighted;
    }
    
    receive() external payable {}
}
