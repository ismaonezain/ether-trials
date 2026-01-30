dfghdfgdfgd
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrials TRIA v2 - Complete Tournament + Mini Games
 * @notice Tournament with FID entries, weighted rewards, mini games (Dice & Spin), and buyback mechanism
 * @dev All ETH entries swap to $TRIA, 80% prize pool, 15% platform fee (10% buyback + 5% treasury), 5% mini games
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

contract EtherTrialsTRIAv2 {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    address public owner;
    address public backendServer;
    address public immutable triaToken;
    IUniswapV2Router public immutable uniswapRouter;
    
    // Timing
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant WALLET_ADD_COOLDOWN = 7 days;
    
    // Entry limits
    uint256 public constant MIN_ENTRY = 0.00001 ether;
    uint256 public constant MAX_ENTRY = 1 ether;
    uint256 public constant MAX_WALLETS_PER_FID = 3;
    
    // Tournament allocations (out of 100%)
    uint256 public constant PRIZE_POOL_ALLOCATION = 80;     // 80% to prize pool
    uint256 public constant BUYBACK_ALLOCATION = 10;        // 10% buyback $TRIA
    uint256 public constant TREASURY_ALLOCATION = 5;        // 5% treasury
    uint256 public constant MINI_GAME_ALLOCATION = 5;       // 5% mini games
    
    // Mini game allocations (out of 100%)
    uint256 public constant MINI_PRIZE_ALLOCATION = 60;     // 60% instant prizes
    uint256 public constant MINI_BUYBACK_ALLOCATION = 15;   // 15% buyback
    uint256 public constant MINI_INJECT_ALLOCATION = 20;    // 20% inject to main pool
    uint256 public constant MINI_MAINTENANCE_ALLOCATION = 5; // 5% maintenance
    
    // Lucky burst
    uint256 public constant LUCKY_BURST_ALLOCATION = 10;    // 10% of profit to lucky burst
    uint256 public luckyBurstChance = 500; // 1:500 default
    
    // Slippage
    uint256 public constant MIN_SLIPPAGE_TOLERANCE = 98; // 2% slippage
    
    // Balances
    uint256 public buybackTRIABalance;      // $TRIA from buybacks (owner withdrawable)
    uint256 public treasuryBalance;         // ETH treasury (owner withdrawable)
    uint256 public miniGameBalance;         // Mini game prize pool
    uint256 public luckyBurstBalance;       // Lucky burst pool
    uint256 public miniMaintenanceBalance;  // Mini game maintenance
    uint256 public miniBuybackTRIABalance;  // Mini game buyback $TRIA
    
    // Period tracking
    uint256 public currentPeriod;
    uint256 public immutable deploymentTime;
    
    // ============================================
    // STRUCTS
    // ============================================
    
    struct Period {
        uint256 startTime;
        uint256 endTime;
        uint256 triaPool;               // Prize pool in $TRIA
        bool finalized;
        uint256[] rankedFIDs;
        mapping(uint256 => uint256) fidRanks;
        uint256 totalWeightedScore;     // Sum of all (score * entry_weight)
    }
    
    struct Entry {
        uint256 score;
        uint256 entryAmountETH;         // Original ETH amount
        uint256 entryWeight;            // Weight for reward calculation (based on ETH amount)
        uint256 timestamp;
        bool exists;
    }
    
    struct FIDProfile {
        address[] approvedWallets;
        mapping(address => bool) isWalletApproved;
        uint256 lastWalletAdded;
        uint256 totalEntriesAllTime;
    }
    
    struct ClaimStatus {
        bool claimed;
        uint256 triaAmount;
    }
    
    struct MiniGameResult {
        bool isWin;
        uint256 prizeAmount;
        bool isLuckyBurst;
        bool isTRIA;            // true = TRIA, false = ETH
    }
    
    // ============================================
    // MAPPINGS
    // ============================================
    
    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(uint256 => Entry)) public entries;
    mapping(uint256 => FIDProfile) private fidProfiles;
    mapping(uint256 => mapping(uint256 => ClaimStatus)) public claimStatus;
    
    // Mini game tracking
    mapping(uint256 => uint256) public fidMiniGamePlays;        // FID => total plays
    mapping(address => uint256) public lastMiniGamePlay;        // Anti-spam
    
    // ============================================
    // EVENTS
    // ============================================
    
    event TournamentEntry(uint256 indexed period, uint256 indexed fid, uint256 ethAmount, uint256 triaReceived, uint256 weight);
    event ScoreSubmitted(uint256 indexed period, uint256 indexed fid, uint256 score);
    event PeriodFinalized(uint256 indexed period, uint256 triaPool, uint256 totalParticipants);
    event RewardsClaimed(uint256 indexed period, uint256 indexed fid, address claimer, uint256 triaAmount);
    event WalletAdded(uint256 indexed fid, address wallet);
    event WalletRemoved(uint256 indexed fid, address wallet);
    event BuybackWithdrawn(address owner, uint256 triaAmount);
    event TreasuryWithdrawn(address owner, uint256 ethAmount);
    event MiniGamePlayed(uint256 indexed fid, string gameType, bool isWin, uint256 prize, bool isLuckyBurst);
    event LuckyBurstWon(uint256 indexed fid, uint256 prize, bool isTRIA);
    
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
    error TooSoon();
    error InvalidGame();
    
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
    // TOURNAMENT ENTRY
    // ============================================
    
    /**
     * @notice Enter tournament - 100% ETH swapped to TRIA
     * @dev 80% prize pool, 10% buyback, 5% treasury, 5% mini games
     */
    function enterTournament(uint256 fid) external payable {
        if (msg.value < MIN_ENTRY || msg.value > MAX_ENTRY) {
            revert InvalidAmount();
        }
        
        uint256 period = _getCurrentPeriod();
        if (entries[period][fid].exists) {
            revert AlreadyEntered();
        }
        
        // Ensure wallet is approved
        if (fidProfiles[fid].approvedWallets.length == 0) {
            _addWalletInternal(fid, msg.sender);
        } else {
            if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
                revert WalletNotApproved();
            }
        }
        
        // Calculate allocations
        uint256 prizePoolETH = (msg.value * PRIZE_POOL_ALLOCATION) / 100;
        uint256 buybackETH = (msg.value * BUYBACK_ALLOCATION) / 100;
        uint256 treasuryETH = (msg.value * TREASURY_ALLOCATION) / 100;
        uint256 miniGameETH = (msg.value * MINI_GAME_ALLOCATION) / 100;
        
        // Swap 80% + 10% (90% total) to TRIA
        uint256 swapAmount = prizePoolETH + buybackETH;
        uint256 triaReceived = _swapETHForTRIA(swapAmount);
        
        // Allocate TRIA
        uint256 prizePoolTRIA = (triaReceived * PRIZE_POOL_ALLOCATION) / (PRIZE_POOL_ALLOCATION + BUYBACK_ALLOCATION);
        uint256 buybackTRIA = triaReceived - prizePoolTRIA;
        
        // Update balances
        periods[period].triaPool += prizePoolTRIA;
        buybackTRIABalance += buybackTRIA;
        treasuryBalance += treasuryETH;
        miniGameBalance += miniGameETH;
        
        // Calculate entry weight (normalized to MIN_ENTRY = 1)
        uint256 weight = (msg.value * 1e18) / MIN_ENTRY;
        
        // Record entry
        entries[period][fid] = Entry({
            score: 0,
            entryAmountETH: msg.value,
            entryWeight: weight,
            timestamp: block.timestamp,
            exists: true
        });
        
        fidProfiles[fid].totalEntriesAllTime++;
        
        emit TournamentEntry(period, fid, msg.value, prizePoolTRIA, weight);
    }
    
    /**
     * @notice Submit score (backend only)
     */
    function submitScore(uint256 period, uint256 fid, uint256 score) external onlyBackend {
        if (!entries[period][fid].exists) {
            revert NoEntry();
        }
        
        // Remove old weighted score
        uint256 oldScore = entries[period][fid].score;
        uint256 weight = entries[period][fid].entryWeight;
        
        if (oldScore > 0) {
            periods[period].totalWeightedScore -= (oldScore * weight) / 1e18;
        }
        
        // Add new weighted score
        entries[period][fid].score = score;
        periods[period].totalWeightedScore += (score * weight) / 1e18;
        
        emit ScoreSubmitted(period, fid, score);
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
        
        // Start next period
        if (period == currentPeriod) {
            currentPeriod++;
            periods[currentPeriod].startTime = block.timestamp;
            periods[currentPeriod].endTime = block.timestamp + PERIOD_DURATION;
        }
        
        emit PeriodFinalized(period, periods[period].triaPool, periods[period].rankedFIDs.length);
    }
    
    // ============================================
    // WALLET MANAGEMENT
    // ============================================
    
    function addWallet(uint256 fid, address wallet) external {
        if (fidProfiles[fid].approvedWallets.length > 0) {
            if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
                revert WalletNotApproved();
            }
        }
        
        if (fidProfiles[fid].approvedWallets.length >= MAX_WALLETS_PER_FID) {
            revert MaxWalletsReached();
        }
        
        if (fidProfiles[fid].approvedWallets.length > 0) {
            if (block.timestamp < fidProfiles[fid].lastWalletAdded + WALLET_ADD_COOLDOWN) {
                revert WalletCooldownActive();
            }
        }
        
        if (fidProfiles[fid].isWalletApproved[wallet]) {
            revert WalletAlreadyApproved();
        }
        
        _addWalletInternal(fid, wallet);
    }
    
    function removeWallet(uint256 fid, address wallet) external {
        if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
            revert WalletNotApproved();
        }
        
        if (fidProfiles[fid].approvedWallets.length <= 1) {
            revert MustKeepOneWallet();
        }
        
        fidProfiles[fid].isWalletApproved[wallet] = false;
        
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
    // CLAIM REWARDS
    // ============================================
    
    /**
     * @notice Claim all rewards from finalized periods
     */
    function claimAllRewards(uint256 fid) external {
        if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
            revert WalletNotApproved();
        }
        
        uint256 totalTRIA = 0;
        
        for (uint256 period = 0; period <= currentPeriod; period++) {
            if (!periods[period].finalized) continue;
            if (!entries[period][fid].exists) continue;
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
    // MINI GAMES
    // ============================================
    
    /**
     * @notice Play Ether Dice mini game
     * @dev 0.00001 ETH entry, instant prize or lucky burst
     */
    function playDice(uint256 fid) external payable returns (MiniGameResult memory) {
        return _playMiniGame(fid, "dice");
    }
    
    /**
     * @notice Play Ether Spin mini game
     */
    function playSpin(uint256 fid) external payable returns (MiniGameResult memory) {
        return _playMiniGame(fid, "spin");
    }
    
    function _playMiniGame(uint256 fid, string memory gameType) internal returns (MiniGameResult memory) {
        if (msg.value != MIN_ENTRY) {
            revert InvalidAmount();
        }
        
        // Anti-spam: 1 second between plays
        if (block.timestamp < lastMiniGamePlay[msg.sender] + 1) {
            revert TooSoon();
        }
        lastMiniGamePlay[msg.sender] = block.timestamp;
        
        // Allocations
        uint256 prizeETH = (msg.value * MINI_PRIZE_ALLOCATION) / 100;
        uint256 buybackETH = (msg.value * MINI_BUYBACK_ALLOCATION) / 100;
        uint256 injectETH = (msg.value * MINI_INJECT_ALLOCATION) / 100;
        uint256 maintenanceETH = (msg.value * MINI_MAINTENANCE_ALLOCATION) / 100;
        
        // Swap buyback + inject to TRIA
        uint256 swapAmount = buybackETH + injectETH;
        uint256 triaReceived = _swapETHForTRIA(swapAmount);
        
        uint256 buybackTRIA = (triaReceived * MINI_BUYBACK_ALLOCATION) / (MINI_BUYBACK_ALLOCATION + MINI_INJECT_ALLOCATION);
        uint256 injectTRIA = triaReceived - buybackTRIA;
        
        // Update balances
        miniBuybackTRIABalance += buybackTRIA;
        periods[currentPeriod].triaPool += injectTRIA;
        miniMaintenanceBalance += maintenanceETH;
        
        // Lucky burst pool (10% of prize allocation)
        uint256 luckyContribution = (prizeETH * LUCKY_BURST_ALLOCATION) / 100;
        luckyBurstBalance += luckyContribution;
        prizeETH -= luckyContribution;
        
        fidMiniGamePlays[fid]++;
        
        // Determine win (pseudo-random)
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, fid, fidMiniGamePlays[fid])));
        
        // Lucky burst check (1:500 or configured)
        bool isLuckyBurst = (random % luckyBurstChance) == 0;
        
        if (isLuckyBurst && luckyBurstBalance >= 0.001 ether) {
            // Lucky burst win!
            uint256 prize = 0.001 ether;
            if (prize > luckyBurstBalance) prize = luckyBurstBalance;
            
            luckyBurstBalance -= prize;
            payable(msg.sender).transfer(prize);
            
            emit LuckyBurstWon(fid, prize, false);
            emit MiniGamePlayed(fid, gameType, true, prize, true);
            
            return MiniGameResult({
                isWin: true,
                prizeAmount: prize,
                isLuckyBurst: true,
                isTRIA: false
            });
        }
        
        // Regular win (50% chance)
        bool isWin = (random % 2) == 0;
        
        if (isWin && prizeETH > 0) {
            // Small prize (0.5x - 2x of entry)
            uint256 multiplier = (random % 150) + 50; // 50-200%
            uint256 prize = (MIN_ENTRY * multiplier) / 100;
            
            if (prize > prizeETH) prize = prizeETH;
            if (prize > miniGameBalance) prize = miniGameBalance;
            
            if (prize > 0) {
                miniGameBalance -= prize;
                payable(msg.sender).transfer(prize);
                
                emit MiniGamePlayed(fid, gameType, true, prize, false);
                
                return MiniGameResult({
                    isWin: true,
                    prizeAmount: prize,
                    isLuckyBurst: false,
                    isTRIA: false
                });
            }
        }
        
        // No win
        emit MiniGamePlayed(fid, gameType, false, 0, false);
        
        return MiniGameResult({
            isWin: false,
            prizeAmount: 0,
            isLuckyBurst: false,
            isTRIA: false
        });
    }
    
    // ============================================
    // OWNER FUNCTIONS
    // ============================================
    
    /**
     * @notice Withdraw buyback $TRIA for redistribution/giveaways
     */
    function withdrawBuyback() external onlyOwner {
        uint256 amount = buybackTRIABalance + miniBuybackTRIABalance;
        if (amount == 0) revert InsufficientBalance();
        
        buybackTRIABalance = 0;
        miniBuybackTRIABalance = 0;
        
        bool success = IERC20(triaToken).transfer(owner, amount);
        if (!success) revert InsufficientBalance();
        
        emit BuybackWithdrawn(owner, amount);
    }
    
    /**
     * @notice Withdraw treasury ETH
     */
    function withdrawTreasury() external onlyOwner {
        uint256 amount = treasuryBalance;
        if (amount == 0) revert InsufficientBalance();
        
        treasuryBalance = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert InsufficientBalance();
        
        emit TreasuryWithdrawn(owner, amount);
    }
    
    /**
     * @notice Withdraw mini game maintenance
     */
    function withdrawMiniMaintenance() external onlyOwner {
        uint256 amount = miniMaintenanceBalance;
        if (amount == 0) revert InsufficientBalance();
        
        miniMaintenanceBalance = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert InsufficientBalance();
    }
    
    /**
     * @notice Add $TRIA to prize pool or lucky burst (from buyback)
     */
    function injectTRIAToPrizePool(uint256 amount) external onlyOwner {
        uint256 available = buybackTRIABalance + miniBuybackTRIABalance;
        if (amount > available) revert InsufficientBalance();
        
        if (amount <= buybackTRIABalance) {
            buybackTRIABalance -= amount;
        } else {
            uint256 remaining = amount - buybackTRIABalance;
            buybackTRIABalance = 0;
            miniBuybackTRIABalance -= remaining;
        }
        
        periods[currentPeriod].triaPool += amount;
    }
    
    /**
     * @notice Update lucky burst chance (default 500 = 1:500)
     */
    function setLuckyBurstChance(uint256 newChance) external onlyOwner {
        luckyBurstChance = newChance;
    }
    
    function setBackendServer(address newBackend) external onlyOwner {
        backendServer = newBackend;
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
    
    function getApprovedWallets(uint256 fid) external view returns (address[] memory) {
        return fidProfiles[fid].approvedWallets;
    }
    
    function isWalletApproved(uint256 fid, address wallet) external view returns (bool) {
        return fidProfiles[fid].isWalletApproved[wallet];
    }
    
    function calculateReward(uint256 period, uint256 fid) external view returns (uint256) {
        return _calculateReward(period, fid);
    }
    
    function getClaimableRewards(uint256 fid) external view returns (uint256 totalTRIA) {
        for (uint256 period = 0; period <= currentPeriod; period++) {
            if (!periods[period].finalized) continue;
            if (!entries[period][fid].exists) continue;
            if (claimStatus[period][fid].claimed) continue;
            
            totalTRIA += _calculateReward(period, fid);
        }
    }
    
    function getPeriodInfo(uint256 period) external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 triaPool,
        bool finalized,
        uint256 totalWeightedScore
    ) {
        Period storage p = periods[period];
        return (p.startTime, p.endTime, p.triaPool, p.finalized, p.totalWeightedScore);
    }
    
    function getBalances() external view returns (
        uint256 buybackTRIA,
        uint256 treasury,
        uint256 miniGame,
        uint256 luckyBurst,
        uint256 miniMaintenance,
        uint256 miniBuyback
    ) {
        return (
            buybackTRIABalance,
            treasuryBalance,
            miniGameBalance,
            luckyBurstBalance,
            miniMaintenanceBalance,
            miniBuybackTRIABalance
        );
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
        
        emit WalletAdded(fid, wallet);
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
    
    /**
     * @notice Calculate weighted reward
     * @dev Reward = (user_weighted_score / total_weighted_score) * prize_pool
     * @dev Weighted score = score * entry_weight
     */
    function _calculateReward(uint256 period, uint256 fid) internal view returns (uint256) {
        if (!entries[period][fid].exists) return 0;
        if (!periods[period].finalized) return 0;
        
        uint256 score = entries[period][fid].score;
        if (score == 0) return 0;
        
        uint256 weight = entries[period][fid].entryWeight;
        uint256 weightedScore = (score * weight) / 1e18;
        
        uint256 totalWeighted = periods[period].totalWeightedScore;
        if (totalWeighted == 0) return 0;
        
        uint256 prizePool = periods[period].triaPool;
        
        // Reward = (weighted_score / total_weighted) * prize_pool
        return (weightedScore * prizePool) / totalWeighted;
    }
    
    receive() external payable {}
}
