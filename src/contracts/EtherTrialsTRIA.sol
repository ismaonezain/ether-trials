asik
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrials TRIA Token Integration
 * @notice Tournament smart contract with FID-based entries, ETH→TRIA swaps, and multi-wallet claims
 * @dev Integrates with Uniswap V2 for automatic token swaps and Farcaster FID system
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
    function approve(address spender, uint256 amount) external returns (bool);
}

contract EtherTrialsTRIA {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice Contract owner (can withdraw platform fees)
    address public owner;
    
    /// @notice Backend server address authorized to submit scores
    address public backendServer;
    
    /// @notice TRIA token contract address
    address public immutable triaToken;
    
    /// @notice Uniswap V2 Router address on Base
    IUniswapV2Router public immutable uniswapRouter;
    
    /// @notice Period duration in seconds (24 hours)
    uint256 public constant PERIOD_DURATION = 24 hours;
    
    /// @notice Allocation percentages
    uint256 public constant TRIA_ALLOCATION = 45; // 45%
    uint256 public constant ETH_ALLOCATION = 45;  // 45%
    uint256 public constant PLATFORM_FEE = 10;    // 10%
    
    /// @notice Minimum and maximum entry amounts
    uint256 public constant MIN_ENTRY = 0.00001 ether;
    uint256 public constant MAX_ENTRY = 1 ether;
    
    /// @notice Maximum wallets per FID
    uint256 public constant MAX_WALLETS_PER_FID = 3;
    
    /// @notice Cooldown between adding wallets (7 days)
    uint256 public constant WALLET_ADD_COOLDOWN = 7 days;
    
    /// @notice Minimum slippage tolerance for swaps (2%)
    uint256 public constant MIN_SLIPPAGE_TOLERANCE = 98; // 98% = 2% slippage
    
    /// @notice Total platform fees accumulated
    uint256 public platformFeeBalance;
    
    /// @notice Current period number
    uint256 public currentPeriod;
    
    /// @notice Contract deployment timestamp
    uint256 public immutable deploymentTime;
    
    // ============================================
    // STRUCTS
    // ============================================
    
    /// @notice Period data structure
    struct Period {
        uint256 startTime;
        uint256 endTime;
        uint256 triaPool;
        uint256 ethPool;
        bool finalized;
        uint256[] rankedFIDs; // Sorted by score, highest first
        mapping(uint256 => uint256) fidRanks; // FID => rank (1-indexed)
    }
    
    /// @notice Entry data for each FID in a period
    struct Entry {
        uint256 score;
        uint256 entryAmount;
        uint256 timestamp;
        bool exists;
    }
    
    /// @notice FID profile with approved wallets
    struct FIDProfile {
        address[] approvedWallets;
        mapping(address => bool) isWalletApproved;
        uint256 lastWalletAdded;
        uint256 totalEntriesAllTime;
    }
    
    /// @notice Claim tracking per period per FID
    struct ClaimStatus {
        bool triaClaimeds;
        bool ethClaimed;
        uint256 triaAmount;
        uint256 ethAmount;
    }
    
    // ============================================
    // MAPPINGS
    // ============================================
    
    /// @notice Period number => Period data
    mapping(uint256 => Period) public periods;
    
    /// @notice Period => FID => Entry
    mapping(uint256 => mapping(uint256 => Entry)) public entries;
    
    /// @notice FID => Profile
    mapping(uint256 => FIDProfile) private fidProfiles;
    
    /// @notice Period => FID => ClaimStatus
    mapping(uint256 => mapping(uint256 => ClaimStatus)) public claimStatus;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event TournamentEntry(
        uint256 indexed period,
        uint256 indexed fid,
        uint256 amount,
        uint256 timestamp
    );
    
    event ScoreSubmitted(
        uint256 indexed period,
        uint256 indexed fid,
        uint256 score,
        uint256 timestamp
    );
    
    event PeriodFinalized(
        uint256 indexed period,
        uint256 triaPool,
        uint256 ethPool,
        uint256 totalParticipants
    );
    
    event WalletAdded(
        uint256 indexed fid,
        address indexed wallet,
        uint256 totalWallets
    );
    
    event WalletRemoved(
        uint256 indexed fid,
        address indexed wallet
    );
    
    event RewardsClaimed(
        uint256 indexed period,
        uint256 indexed fid,
        address indexed claimer,
        uint256 triaAmount,
        uint256 ethAmount
    );
    
    event TokenSwapped(
        uint256 indexed period,
        uint256 ethAmount,
        uint256 triaAmount
    );
    
    event PlatformFeeWithdrawn(
        address indexed owner,
        uint256 amount
    );
    
    // ============================================
    // ERRORS
    // ============================================
    
    error Unauthorized();
    error InvalidAmount();
    error AlreadyEntered();
    error PeriodNotEnded();
    error PeriodAlreadyFinalized();
    error NoEntry();
    error MaxWalletsReached();
    error WalletCooldownActive();
    error WalletNotApproved();
    error WalletAlreadyApproved();
    error MustKeepOneWallet();
    error AlreadyClaimed();
    error NoRewardsToClaim();
    error InsufficientBalance();
    error SwapFailed();
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier onlyBackend() {
        if (msg.sender != backendServer) revert Unauthorized();
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        address _triaToken,
        address _uniswapRouter,
        address _backendServer
    ) {
        owner = msg.sender;
        triaToken = _triaToken;
        uniswapRouter = IUniswapV2Router(_uniswapRouter);
        backendServer = _backendServer;
        deploymentTime = block.timestamp;
        
        // Initialize first period
        currentPeriod = 0;
        periods[0].startTime = block.timestamp;
        periods[0].endTime = block.timestamp + PERIOD_DURATION;
    }
    
    // ============================================
    // ENTRY FUNCTIONS
    // ============================================
    
    /**
     * @notice Enter tournament for current period
     * @dev Automatically swaps 45% ETH to TRIA, deposits 45% ETH, takes 10% platform fee
     * @param fid Farcaster FID of the player
     */
    function enterTournament(uint256 fid) external payable {
        // Validate entry amount
        if (msg.value < MIN_ENTRY || msg.value > MAX_ENTRY) {
            revert InvalidAmount();
        }
        
        // Check if already entered this period
        uint256 period = _getCurrentPeriod();
        if (entries[period][fid].exists) {
            revert AlreadyEntered();
        }
        
        // Must have at least one approved wallet
        if (fidProfiles[fid].approvedWallets.length == 0) {
            // Auto-approve first wallet
            _addWalletInternal(fid, msg.sender);
        } else {
            // Must be calling from an approved wallet
            if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
                revert WalletNotApproved();
            }
        }
        
        // Calculate splits
        uint256 triaAmount = (msg.value * TRIA_ALLOCATION) / 100;
        uint256 ethAmount = (msg.value * ETH_ALLOCATION) / 100;
        uint256 platformFee = (msg.value * PLATFORM_FEE) / 100;
        
        // Swap ETH to TRIA via Uniswap
        uint256 triaReceived = _swapETHForTRIA(triaAmount);
        
        // Update pools
        periods[period].triaPool += triaReceived;
        periods[period].ethPool += ethAmount;
        platformFeeBalance += platformFee;
        
        // Record entry
        entries[period][fid] = Entry({
            score: 0,
            entryAmount: msg.value,
            timestamp: block.timestamp,
            exists: true
        });
        
        // Update profile stats
        fidProfiles[fid].totalEntriesAllTime++;
        
        emit TournamentEntry(period, fid, msg.value, block.timestamp);
    }
    
    /**
     * @notice Submit score for a FID (backend only)
     * @param period Period number
     * @param fid Farcaster FID
     * @param score Final score achieved
     */
    function submitScore(
        uint256 period,
        uint256 fid,
        uint256 score
    ) external onlyBackend {
        if (!entries[period][fid].exists) {
            revert NoEntry();
        }
        
        entries[period][fid].score = score;
        
        emit ScoreSubmitted(period, fid, score, block.timestamp);
    }
    
    // ============================================
    // PERIOD MANAGEMENT
    // ============================================
    
    /**
     * @notice Finalize a period and rank all participants
     * @dev Can be called by anyone after period ends (trustless)
     * @param period Period number to finalize
     */
    function finalizePeriod(uint256 period) external {
        if (periods[period].finalized) {
            revert PeriodAlreadyFinalized();
        }
        
        if (block.timestamp < periods[period].endTime) {
            revert PeriodNotEnded();
        }
        
        // Rank all participants by score
        uint256[] memory rankedFIDs = _rankParticipants(period);
        
        // Store rankings
        periods[period].rankedFIDs = rankedFIDs;
        for (uint256 i = 0; i < rankedFIDs.length; i++) {
            periods[period].fidRanks[rankedFIDs[i]] = i + 1; // 1-indexed rank
        }
        
        periods[period].finalized = true;
        
        // Start next period if current
        if (period == currentPeriod) {
            currentPeriod++;
            periods[currentPeriod].startTime = block.timestamp;
            periods[currentPeriod].endTime = block.timestamp + PERIOD_DURATION;
        }
        
        emit PeriodFinalized(
            period,
            periods[period].triaPool,
            periods[period].ethPool,
            rankedFIDs.length
        );
    }
    
    // ============================================
    // WALLET MANAGEMENT
    // ============================================
    
    /**
     * @notice Add a wallet to FID's approved list
     * @param fid Farcaster FID
     * @param wallet Wallet address to approve
     */
    function addWallet(uint256 fid, address wallet) external {
        // Must be called by an existing approved wallet OR be first wallet
        if (fidProfiles[fid].approvedWallets.length > 0) {
            if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
                revert WalletNotApproved();
            }
        }
        
        // Check max wallets limit
        if (fidProfiles[fid].approvedWallets.length >= MAX_WALLETS_PER_FID) {
            revert MaxWalletsReached();
        }
        
        // Check cooldown (except for first wallet)
        if (fidProfiles[fid].approvedWallets.length > 0) {
            if (block.timestamp < fidProfiles[fid].lastWalletAdded + WALLET_ADD_COOLDOWN) {
                revert WalletCooldownActive();
            }
        }
        
        // Check if already approved
        if (fidProfiles[fid].isWalletApproved[wallet]) {
            revert WalletAlreadyApproved();
        }
        
        _addWalletInternal(fid, wallet);
    }
    
    /**
     * @notice Remove a wallet from FID's approved list
     * @param fid Farcaster FID
     * @param wallet Wallet to remove
     */
    function removeWallet(uint256 fid, address wallet) external {
        // Must be called by an approved wallet
        if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
            revert WalletNotApproved();
        }
        
        // Must keep at least 1 wallet
        if (fidProfiles[fid].approvedWallets.length <= 1) {
            revert MustKeepOneWallet();
        }
        
        // Remove wallet
        fidProfiles[fid].isWalletApproved[wallet] = false;
        
        // Remove from array
        address[] storage wallets = fidProfiles[fid].approvedWallets;
        for (uint256 i = 0; i < wallets.length; i++) {
            if (wallets[i] == wallet) {
                wallets[i] = wallets[wallets.length - 1];
                wallets.pop();
                break;
            }
        }
        
        emit WalletRemoved(fid, wallet);
    }
    
    // ============================================
    // CLAIM FUNCTIONS
    // ============================================
    
    /**
     * @notice Claim rewards for all finalized periods
     * @param fid Farcaster FID to claim for
     */
    function claimAllRewards(uint256 fid) external {
        // Must be an approved wallet
        if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
            revert WalletNotApproved();
        }
        
        uint256 totalTRIA = 0;
        uint256 totalETH = 0;
        
        // Loop through all periods
        for (uint256 period = 0; period <= currentPeriod; period++) {
            if (!periods[period].finalized) continue;
            if (!entries[period][fid].exists) continue;
            
            ClaimStatus storage status = claimStatus[period][fid];
            
            // Calculate rewards if not claimed
            if (!status.triaClaimeds || !status.ethClaimed) {
                (uint256 triaReward, uint256 ethReward) = _calculateReward(period, fid);
                
                if (!status.triaClaimeds && triaReward > 0) {
                    status.triaClaimeds = true;
                    status.triaAmount = triaReward;
                    totalTRIA += triaReward;
                }
                
                if (!status.ethClaimed && ethReward > 0) {
                    status.ethClaimed = true;
                    status.ethAmount = ethReward;
                    totalETH += ethReward;
                }
            }
        }
        
        if (totalTRIA == 0 && totalETH == 0) {
            revert NoRewardsToClaim();
        }
        
        // Transfer rewards
        if (totalTRIA > 0) {
            bool success = IERC20(triaToken).transfer(msg.sender, totalTRIA);
            if (!success) revert InsufficientBalance();
        }
        
        if (totalETH > 0) {
            (bool success, ) = payable(msg.sender).call{value: totalETH}("");
            if (!success) revert InsufficientBalance();
        }
        
        emit RewardsClaimed(currentPeriod, fid, msg.sender, totalTRIA, totalETH);
    }
    
    /**
     * @notice Claim rewards for a specific period
     * @param period Period number
     * @param fid Farcaster FID
     */
    function claimPeriodRewards(uint256 period, uint256 fid) external {
        if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
            revert WalletNotApproved();
        }
        
        if (!periods[period].finalized) {
            revert PeriodNotEnded();
        }
        
        ClaimStatus storage status = claimStatus[period][fid];
        
        if (status.triaClaimeds && status.ethClaimed) {
            revert AlreadyClaimed();
        }
        
        (uint256 triaReward, uint256 ethReward) = _calculateReward(period, fid);
        
        if (triaReward == 0 && ethReward == 0) {
            revert NoRewardsToClaim();
        }
        
        status.triaClaimeds = true;
        status.ethClaimed = true;
        status.triaAmount = triaReward;
        status.ethAmount = ethReward;
        
        // Transfer rewards
        if (triaReward > 0) {
            bool success = IERC20(triaToken).transfer(msg.sender, triaReward);
            if (!success) revert InsufficientBalance();
        }
        
        if (ethReward > 0) {
            (bool success, ) = payable(msg.sender).call{value: ethReward}("");
            if (!success) revert InsufficientBalance();
        }
        
        emit RewardsClaimed(period, fid, msg.sender, triaReward, ethReward);
    }
    
    // ============================================
    // OWNER FUNCTIONS
    // ============================================
    
    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawPlatformFees() external onlyOwner {
        uint256 amount = platformFeeBalance;
        platformFeeBalance = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert InsufficientBalance();
        
        emit PlatformFeeWithdrawn(owner, amount);
    }
    
    /**
     * @notice Update backend server address
     * @param newBackend New backend address
     */
    function setBackendServer(address newBackend) external onlyOwner {
        backendServer = newBackend;
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get current period number
     */
    function getCurrentPeriod() external view returns (uint256) {
        return _getCurrentPeriod();
    }
    
    /**
     * @notice Get approved wallets for a FID
     * @param fid Farcaster FID
     */
    function getApprovedWallets(uint256 fid) external view returns (address[] memory) {
        return fidProfiles[fid].approvedWallets;
    }
    
    /**
     * @notice Check if wallet is approved for FID
     * @param fid Farcaster FID
     * @param wallet Wallet address
     */
    function isWalletApproved(uint256 fid, address wallet) external view returns (bool) {
        return fidProfiles[fid].isWalletApproved[wallet];
    }
    
    /**
     * @notice Get period rankings
     * @param period Period number
     */
    function getPeriodRankings(uint256 period) external view returns (uint256[] memory) {
        return periods[period].rankedFIDs;
    }
    
    /**
     * @notice Get FID rank in a period
     * @param period Period number
     * @param fid Farcaster FID
     */
    function getFIDRank(uint256 period, uint256 fid) external view returns (uint256) {
        return periods[period].fidRanks[fid];
    }
    
    /**
     * @notice Calculate potential rewards for a FID in a period
     * @param period Period number
     * @param fid Farcaster FID
     */
    function calculateRewards(uint256 period, uint256 fid) external view returns (uint256 triaReward, uint256 ethReward) {
        return _calculateReward(period, fid);
    }
    
    /**
     * @notice Get claimable rewards across all periods
     * @param fid Farcaster FID
     */
    function getClaimableRewards(uint256 fid) external view returns (uint256 totalTRIA, uint256 totalETH) {
        for (uint256 period = 0; period <= currentPeriod; period++) {
            if (!periods[period].finalized) continue;
            if (!entries[period][fid].exists) continue;
            
            ClaimStatus storage status = claimStatus[period][fid];
            
            if (!status.triaClaimeds || !status.ethClaimed) {
                (uint256 triaReward, uint256 ethReward) = _calculateReward(period, fid);
                
                if (!status.triaClaimeds) {
                    totalTRIA += triaReward;
                }
                
                if (!status.ethClaimed) {
                    totalETH += ethReward;
                }
            }
        }
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
    
    function _addWalletInternal(uint256 fid, address wallet) internal {
        fidProfiles[fid].approvedWallets.push(wallet);
        fidProfiles[fid].isWalletApproved[wallet] = true;
        fidProfiles[fid].lastWalletAdded = block.timestamp;
        
        emit WalletAdded(fid, wallet, fidProfiles[fid].approvedWallets.length);
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
            block.timestamp + 300 // 5 minute deadline
        ) returns (uint256[] memory amounts) {
            emit TokenSwapped(_getCurrentPeriod(), ethAmount, amounts[1]);
            return amounts[1];
        } catch {
            revert SwapFailed();
        }
    }
    
    function _rankParticipants(uint256 period) internal view returns (uint256[] memory) {
        // Get all FIDs with entries
        uint256 count = 0;
        uint256[] memory tempFIDs = new uint256[](10000); // Max participants assumption
        
        // This is simplified - in production you'd maintain a participants list
        // For now, this is a placeholder that would need off-chain indexing
        
        return new uint256[](0); // Placeholder
    }
    
    function _calculateReward(uint256 period, uint256 fid) internal view returns (uint256 triaReward, uint256 ethReward) {
        if (!entries[period][fid].exists) {
            return (0, 0);
        }
        
        uint256 rank = periods[period].fidRanks[fid];
        if (rank == 0) return (0, 0); // Not ranked
        
        uint256 totalParticipants = periods[period].rankedFIDs.length;
        if (totalParticipants == 0) return (0, 0);
        
        // Prize distribution: Top 10% get rewards
        uint256 winnersCount = (totalParticipants / 10) + 1;
        if (rank > winnersCount) return (0, 0);
        
        // Distribution curve: 1st = 30%, 2nd = 20%, 3rd = 15%, rest split remaining 35%
        uint256 triaPool = periods[period].triaPool;
        uint256 ethPool = periods[period].ethPool;
        
        if (rank == 1) {
            return (triaPool * 30 / 100, ethPool * 30 / 100);
        } else if (rank == 2) {
            return (triaPool * 20 / 100, ethPool * 20 / 100);
        } else if (rank == 3) {
            return (triaPool * 15 / 100, ethPool * 15 / 100);
        } else {
            // Split remaining 35% among the rest
            uint256 remainingWinners = winnersCount - 3;
            if (remainingWinners == 0) return (0, 0);
            
            return (
                triaPool * 35 / 100 / remainingWinners,
                ethPool * 35 / 100 / remainingWinners
            );
        }
    }
    
    // ============================================
    // RECEIVE FUNCTION
    // ============================================
    
    receive() external payable {}
}
