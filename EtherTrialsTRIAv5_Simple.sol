// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrials TRIA v5 - SIMPLE & FIXED
 * @notice Simplified tournament - no mini games, no wallet approval, just pure competition!
 * @dev Auto-add first wallet, clear period status, guaranteed countdown
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

contract EtherTrialsTRIAv5 {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    address public owner;
    address public immutable triaToken;
    IUniswapV2Router public immutable uniswapRouter;
    
    // Timing - 24 hours per period
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant SCORE_REVEAL_WINDOW = 10 minutes;
    
    // Entry limits
    uint256 public constant MIN_ENTRY = 0.00001 ether;
    uint256 public constant MAX_ENTRY = 1 ether;
    
    // Allocations (out of 100%)
    uint256 public constant PRIZE_POOL_ALLOCATION = 85;     // 85% to prize pool
    uint256 public constant BUYBACK_ALLOCATION = 10;        // 10% buyback $TRIA
    uint256 public constant TREASURY_ALLOCATION = 5;        // 5% treasury
    
    // Slippage
    uint256 public constant MIN_SLIPPAGE_TOLERANCE = 98; // 2% slippage
    
    // Balances
    uint256 public buybackTRIABalance;
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
        address wallet; // Track which wallet entered
        bool exists;
    }
    
    // Commitment scheme for anti-cheat
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
    
    // ============================================
    // MAPPINGS
    // ============================================
    
    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(uint256 => Entry)) public entries;
    mapping(uint256 => mapping(uint256 => ScoreCommitment)) public scoreCommitments;
    mapping(uint256 => mapping(uint256 => ClaimStatus)) public claimStatus;
    
    // FID to wallet tracking (simplified - just store the wallet that entered)
    mapping(uint256 => address) public fidToWallet;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event TournamentEntry(uint256 indexed period, uint256 indexed fid, address wallet, uint256 ethAmount, uint256 triaReceived, uint256 weight);
    event ScoreCommitted(uint256 indexed period, uint256 indexed fid, bytes32 commitHash);
    event ScoreRevealed(uint256 indexed period, uint256 indexed fid, uint256 score);
    event PeriodFinalized(uint256 indexed period, uint256 triaPool, uint256 totalWeightedScore, uint256 participants);
    event RewardsClaimed(uint256 indexed period, uint256 indexed fid, address claimer, uint256 triaAmount);
    event BuybackWithdrawn(address owner, uint256 triaAmount);
    event TreasuryWithdrawn(address owner, uint256 ethAmount);
    
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
    error WrongWallet();
    
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
        
        // Initialize period 0 with CLEAR start and end times
        currentPeriod = 0;
        periods[0].startTime = block.timestamp;
        periods[0].endTime = block.timestamp + PERIOD_DURATION;
        periods[0].finalized = false;
        periods[0].participantCount = 0;
    }
    
    // ============================================
    // TOURNAMENT ENTRY - SIMPLIFIED!
    // ============================================
    
    /**
     * @notice Enter tournament - Auto-add wallet on first entry!
     * @dev No wallet approval needed, just enter and play!
     */
    function enterTournament(uint256 fid) external payable {
        if (msg.value < MIN_ENTRY || msg.value > MAX_ENTRY) {
            revert InvalidAmount();
        }
        
        uint256 period = _getCurrentPeriod();
        if (entries[period][fid].exists) {
            revert AlreadyEntered();
        }
        
        // Auto-add wallet if first time, or check if same wallet
        if (fidToWallet[fid] == address(0)) {
            fidToWallet[fid] = msg.sender;
        } else {
            if (fidToWallet[fid] != msg.sender) {
                revert WrongWallet();
            }
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
        
        // Calculate entry weight (0.00001 ETH = 1, 1 ETH = 100,000)
        uint256 weight = (msg.value * 1e18) / MIN_ENTRY;
        
        entries[period][fid] = Entry({
            entryAmountETH: msg.value,
            entryWeight: weight,
            timestamp: block.timestamp,
            wallet: msg.sender,
            exists: true
        });
        
        emit TournamentEntry(period, fid, msg.sender, msg.value, prizePoolTRIA, weight);
    }
    
    /**
     * @notice Commit score hash (step 1 of anti-cheat)
     * @dev Player commits keccak256(fid, score, nonce, timestamp)
     */
    function commitScore(uint256 period, uint256 fid, bytes32 commitHash) external {
        if (!entries[period][fid].exists) {
            revert NoEntry();
        }
        
        if (fidToWallet[fid] != msg.sender) {
            revert WrongWallet();
        }
        
        if (scoreCommitments[period][fid].commitHash != bytes32(0)) {
            revert AlreadyCommitted();
        }
        
        scoreCommitments[period][fid] = ScoreCommitment({
            commitHash: commitHash,
            commitTime: block.timestamp,
            score: 0,
            revealed: false
        });
        
        emit ScoreCommitted(period, fid, commitHash);
    }
    
    /**
     * @notice Reveal score (step 2 of anti-cheat)
     * @dev Must match committed hash, within 10 minute window
     */
    function revealScore(
        uint256 period,
        uint256 fid,
        uint256 score,
        uint256 nonce,
        uint256 timestamp
    ) external {
        ScoreCommitment storage commitment = scoreCommitments[period][fid];
        
        if (commitment.commitHash == bytes32(0)) {
            revert NotCommitted();
        }
        
        if (commitment.revealed) {
            revert AlreadyCommitted();
        }
        
        if (block.timestamp > commitment.commitTime + SCORE_REVEAL_WINDOW) {
            revert RevealWindowExpired();
        }
        
        // Verify hash matches
        bytes32 revealHash = keccak256(abi.encodePacked(fid, score, nonce, timestamp));
        if (revealHash != commitment.commitHash) {
            revert InvalidReveal();
        }
        
        // Update score
        commitment.score = score;
        commitment.revealed = true;
        
        uint256 weight = entries[period][fid].entryWeight;
        periods[period].totalWeightedScore += (score * weight) / 1e18;
        
        emit ScoreRevealed(period, fid, score);
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
    
    function claimAllRewards(uint256 fid) external {
        if (fidToWallet[fid] != msg.sender) {
            revert WrongWallet();
        }
        
        uint256 totalTRIA = 0;
        
        for (uint256 period = 0; period <= currentPeriod; period++) {
            if (!periods[period].finalized) continue;
            if (!entries[period][fid].exists) continue;
            if (!scoreCommitments[period][fid].revealed) continue;
            if (claimStatus[period][fid].claimed) continue;
            
            uint256 reward = _calculateReward(period, fid);
            
            if (reward > 0) {
                claimStatus[period][fid].claimed = true;
                claimStatus[period][fid].triaAmount = reward;
                totalTRIA += reward;
            }
        }
        
        if (totalTRIA == 0) {
            revert NoRewardsToClaim();
        }
        
        bool success = IERC20(triaToken).transfer(msg.sender, totalTRIA);
        if (!success) revert InsufficientBalance();
        
        emit RewardsClaimed(currentPeriod, fid, msg.sender, totalTRIA);
    }
    
    // ============================================
    // OWNER FUNCTIONS
    // ============================================
    
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
    
    // Emergency withdraw for owner
    function emergencyWithdrawETH() external onlyOwner {
        (bool success, ) = payable(owner).call{value: address(this).balance}("");
        if (!success) revert InsufficientBalance();
    }
    
    // ============================================
    // VIEW FUNCTIONS - OPTIMIZED!
    // ============================================
    
    function getCurrentPeriod() external view returns (uint256) {
        return _getCurrentPeriod();
    }
    
    function calculateReward(uint256 period, uint256 fid) external view returns (uint256) {
        return _calculateReward(period, fid);
    }
    
    function getClaimableRewards(uint256 fid) external view returns (uint256 totalTRIA) {
        for (uint256 period = 0; period <= currentPeriod; period++) {
            if (!periods[period].finalized) continue;
            if (!entries[period][fid].exists) continue;
            if (!scoreCommitments[period][fid].revealed) continue;
            if (claimStatus[period][fid].claimed) continue;
            
            totalTRIA += _calculateReward(period, fid);
        }
    }
    
    /**
     * @notice Get complete period info - ALL IN ONE CALL!
     * @dev Reduces RPC calls from 13 to 1!
     */
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
        
        // Calculate time remaining
        uint256 now = block.timestamp;
        uint256 remaining = 0;
        if (now < p.endTime) {
            remaining = p.endTime - now;
        }
        
        // Calculate status
        string memory statusStr;
        if (p.finalized) {
            statusStr = "finalized";
        } else if (now < p.startTime) {
            statusStr = "not-started";
        } else if (now >= p.startTime && now < p.endTime) {
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
    
    /**
     * @notice Get user info for a period - ALL IN ONE CALL!
     * @dev Returns entry, score commitment, and claim status together
     */
    function getUserInfo(uint256 period, uint256 fid) external view returns (
        bool hasEntered,
        uint256 entryAmountETH,
        uint256 entryWeight,
        address wallet,
        bool hasCommitted,
        bool hasRevealed,
        uint256 score,
        bool hasClaimed,
        uint256 claimedAmount,
        uint256 pendingReward
    ) {
        Entry storage entry = entries[period][fid];
        ScoreCommitment storage commitment = scoreCommitments[period][fid];
        ClaimStatus storage claim = claimStatus[period][fid];
        
        return (
            entry.exists,
            entry.entryAmountETH,
            entry.entryWeight,
            entry.wallet,
            commitment.commitHash != bytes32(0),
            commitment.revealed,
            commitment.score,
            claim.claimed,
            claim.triaAmount,
            _calculateReward(period, fid)
        );
    }
    
    function getWalletForFid(uint256 fid) external view returns (address) {
        return fidToWallet[fid];
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
    
    function _calculateReward(uint256 period, uint256 fid) internal view returns (uint256) {
        if (!entries[period][fid].exists) return 0;
        if (!periods[period].finalized) return 0;
        if (!scoreCommitments[period][fid].revealed) return 0;
        
        uint256 score = scoreCommitments[period][fid].score;
        if (score == 0) return 0;
        
        uint256 weight = entries[period][fid].entryWeight;
        uint256 weightedScore = (score * weight) / 1e18;
        
        uint256 totalWeighted = periods[period].totalWeightedScore;
        if (totalWeighted == 0) return 0;
        
        uint256 prizePool = periods[period].triaPool;
        
        return (weightedScore * prizePool) / totalWeighted;
    }
    
    receive() external payable {}
}
