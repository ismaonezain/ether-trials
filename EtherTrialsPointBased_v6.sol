// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrials Point-Based v6 - With Uniswap V4 Support
 * @notice Tournament contract with Uniswap V4 Universal Router integration
 * @dev Uses Universal Router for ETH to TRIA swaps
 */

interface IUniversalRouter {
    function execute(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable;
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract EtherTrialsPointBased_v6 {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    address public owner;
    address public immutable triaToken;
    address public immutable universalRouter;
    address public immutable weth;
    address public immutable poolManager; // Uniswap V4 PoolManager
    
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
    
    // V4 Pool Configuration
    bytes32 public poolKey; // Encoded pool parameters
    
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
        address wallet;
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
    
    // ============================================
    // MAPPINGS
    // ============================================
    
    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(uint256 => Entry)) public entries;
    mapping(uint256 => mapping(uint256 => ScoreCommitment)) public scoreCommitments;
    mapping(uint256 => mapping(uint256 => ClaimStatus)) public claimStatus;
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
        address _universalRouter,
        address _weth,
        address _poolManager,
        bytes32 _poolKey
    ) {
        owner = msg.sender;
        triaToken = _triaToken;
        universalRouter = _universalRouter;
        weth = _weth;
        poolManager = _poolManager;
        poolKey = _poolKey;
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
    
    function enterTournament(uint256 fid) external payable {
        if (msg.value < MIN_ENTRY || msg.value > MAX_ENTRY) {
            revert InvalidAmount();
        }
        
        uint256 period = _getCurrentPeriod();
        if (entries[period][fid].exists) {
            revert AlreadyEntered();
        }
        
        // Auto-add wallet if first time
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
        
        // Swap to TRIA using V4 (85% + 10%)
        uint256 swapAmount = prizePoolETH + buybackETH;
        uint256 triaReceived = _swapETHToTRIAV4(swapAmount);
        
        uint256 prizePoolTRIA = (triaReceived * PRIZE_POOL_ALLOCATION) / (PRIZE_POOL_ALLOCATION + BUYBACK_ALLOCATION);
        uint256 buybackTRIA = triaReceived - prizePoolTRIA;
        
        // Update balances
        periods[period].triaPool += prizePoolTRIA;
        buybackTRIABalance += buybackTRIA;
        treasuryBalance += treasuryETH;
        periods[period].participantCount++;
        
        // Calculate entry weight
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
    
    // ============================================
    // UNISWAP V4 SWAP FUNCTION - FIXED IMPLEMENTATION
    // ============================================
    
    /**
     * @notice Swap ETH to TRIA using Uniswap V4 Universal Router
     * @dev Uses V4Planner pattern: Single V4_SWAP command with encoded V4 actions
     * V4 Actions: SWAP_EXACT_IN_SINGLE -> SETTLE_ALL -> TAKE_ALL
     * Reference: https://docs.uniswap.org/contracts/v4/guides/swaps/single-hop-swap
     */
    function _swapETHToTRIAV4(uint256 ethAmount) internal returns (uint256) {
        // Calculate minimum output with slippage tolerance
        uint256 minOutput = (ethAmount * MIN_SLIPPAGE_TOLERANCE) / 100;
        
        // V4 Action IDs from @uniswap/v4-sdk
        bytes1 SWAP_EXACT_IN_SINGLE = 0x00;  // V4 action for exact input single-hop swap
        bytes1 SETTLE_ALL = 0x09;             // V4 action to settle input currency
        bytes1 TAKE_ALL = 0x0a;               // V4 action to take output currency
        
        // Build V4 actions following the official V4Planner pattern
        bytes memory v4Actions = abi.encodePacked(
            SWAP_EXACT_IN_SINGLE,
            SETTLE_ALL,
            TAKE_ALL
        );
        
        // Encode V4 action parameters following the V4Planner pattern
        // SWAP_EXACT_IN_SINGLE params: poolKey, zeroForOne, amountIn, amountOutMinimum, hookData
        // SETTLE_ALL params: currency, amount
        // TAKE_ALL params: currency, amountMin
        bytes memory v4Params = abi.encode(
            // SWAP_EXACT_IN_SINGLE parameters
            poolKey,                    // Pool identification
            true,                       // zeroForOne (WETH -> TRIA)
            ethAmount,                  // amountIn
            minOutput,                  // amountOutMinimum (slippage protection)
            bytes(""),                  // hookData
            // SETTLE_ALL parameters
            weth,                       // currency to settle (WETH)
            ethAmount,                  // amount to settle
            // TAKE_ALL parameters
            triaToken,                  // currency to take (TRIA)
            minOutput                   // minimum amount to take
        );
        
        // Encode the V4 actions and params together
        bytes memory encodedV4Actions = abi.encode(v4Actions, v4Params);
        
        // Universal Router command: V4_SWAP (0x10)
        bytes memory commands = abi.encodePacked(bytes1(0x10));
        
        // Single input containing the encoded V4 actions
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = encodedV4Actions;
        
        // Track balance before swap
        uint256 triaBalanceBefore = IERC20(triaToken).balanceOf(address(this));
        
        // Execute the swap via Universal Router with ETH value
        try IUniversalRouter(universalRouter).execute{value: ethAmount}(
            commands,
            inputs,
            block.timestamp + 300  // 5 minute deadline
        ) {
            uint256 triaBalanceAfter = IERC20(triaToken).balanceOf(address(this));
            return triaBalanceAfter - triaBalanceBefore;
        } catch {
            revert SwapFailed();
        }
    }
    
    // ============================================
    // SCORE COMMITMENT FUNCTIONS
    // ============================================
    
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
        
        bytes32 revealHash = keccak256(abi.encodePacked(fid, score, nonce, timestamp));
        if (revealHash != commitment.commitHash) {
            revert InvalidReveal();
        }
        
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
    
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
    
    // ============================================
    // VIEW FUNCTIONS
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
        
        uint256 now = block.timestamp;
        uint256 remaining = 0;
        if (now < p.endTime) {
            remaining = p.endTime - now;
        }
        
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
