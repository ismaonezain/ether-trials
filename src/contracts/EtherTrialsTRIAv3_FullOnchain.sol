kokok
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrials TRIA v3 - Full Onchain Mini Games
 * @notice Tournament + Full Onchain Dice & Spin Games
 * @dev Uses blockhash for randomness (upgradeable to Chainlink VRF later)
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

contract EtherTrialsTRIAv3 {
    
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
    uint256 public constant MINI_GAME_COST = 0.00001 ether;
    
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
    uint256 public constant LUCKY_BURST_MIN = 0.001 ether;
    
    // Slippage
    uint256 public constant MIN_SLIPPAGE_TOLERANCE = 98; // 2% slippage
    
    // Balances
    uint256 public buybackTRIABalance;
    uint256 public treasuryBalance;
    uint256 public miniGameBalance;
    uint256 public luckyBurstBalance;
    uint256 public miniMaintenanceBalance;
    uint256 public miniBuybackTRIABalance;
    
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
        uint256[] rankedFIDs;
        mapping(uint256 => uint256) fidRanks;
        uint256 totalWeightedScore;
    }
    
    struct Entry {
        uint256 score;
        uint256 entryAmountETH;
        uint256 entryWeight;
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
    
    // Full onchain game results
    struct DiceResult {
        uint8 dice1;
        uint8 dice2;
        uint8 total;
        bool isWin;
        uint256 prizeAmount;
        bool isLuckyBurst;
        bool isTRIA;
    }
    
    struct SpinResult {
        uint8 number;          // 0-36 (like roulette)
        string color;          // "red", "black", "green"
        bool isWin;
        uint256 prizeAmount;
        uint256 multiplier;    // Prize multiplier
        bool isLuckyBurst;
        bool isTRIA;
    }
    
    // ============================================
    // MAPPINGS
    // ============================================
    
    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(uint256 => Entry)) public entries;
    mapping(uint256 => FIDProfile) private fidProfiles;
    mapping(uint256 => mapping(uint256 => ClaimStatus)) public claimStatus;
    
    // Mini game tracking
    mapping(uint256 => uint256) public fidMiniGamePlays;
    mapping(address => uint256) public lastMiniGamePlay;
    
    // Pending randomness requests (for future Chainlink VRF integration)
    mapping(bytes32 => address) public pendingRequests;
    
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
    
    // Onchain game events
    event DicePlayed(uint256 indexed fid, uint8 dice1, uint8 dice2, uint8 total, bool isWin, uint256 prize, bool isLuckyBurst);
    event SpinPlayed(uint256 indexed fid, uint8 number, string color, bool isWin, uint256 prize, uint256 multiplier, bool isLuckyBurst);
    event LuckyBurstWon(uint256 indexed fid, uint256 prize, bool isTRIA, string gameType);
    
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
        
        currentPeriod = 0;
        periods[0].startTime = block.timestamp;
        periods[0].endTime = block.timestamp + PERIOD_DURATION;
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
        
        // Swap 80% + 10% to TRIA
        uint256 swapAmount = prizePoolETH + buybackETH;
        uint256 triaReceived = _swapETHForTRIA(swapAmount);
        
        uint256 prizePoolTRIA = (triaReceived * PRIZE_POOL_ALLOCATION) / (PRIZE_POOL_ALLOCATION + BUYBACK_ALLOCATION);
        uint256 buybackTRIA = triaReceived - prizePoolTRIA;
        
        // Update balances
        periods[period].triaPool += prizePoolTRIA;
        buybackTRIABalance += buybackTRIA;
        treasuryBalance += treasuryETH;
        miniGameBalance += miniGameETH;
        
        uint256 weight = (msg.value * 1e18) / MIN_ENTRY;
        
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
    
    function submitScore(uint256 period, uint256 fid, uint256 score) external onlyBackend {
        if (!entries[period][fid].exists) {
            revert NoEntry();
        }
        
        uint256 oldScore = entries[period][fid].score;
        uint256 weight = entries[period][fid].entryWeight;
        
        if (oldScore > 0) {
            periods[period].totalWeightedScore -= (oldScore * weight) / 1e18;
        }
        
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
    // FULL ONCHAIN MINI GAMES
    // ============================================
    
    /**
     * @notice Play Ether Dice - Roll 2 dice (1-6 each)
     * @dev Win conditions:
     *      - Sum = 7: 2x prize
     *      - Sum = 2 or 12: 5x prize
     *      - Doubles (same number): 3x prize
     *      - Lucky burst: 1:500 for 0.001 ETH
     */
    function playDice(uint256 fid) external payable returns (DiceResult memory) {
        if (msg.value != MINI_GAME_COST) {
            revert InvalidAmount();
        }
        
        // Anti-spam
        if (block.timestamp < lastMiniGamePlay[msg.sender] + 1) {
            revert TooSoon();
        }
        lastMiniGamePlay[msg.sender] = block.timestamp;
        
        // Process entry fee
        _processMiniGameEntry();
        
        fidMiniGamePlays[fid]++;
        
        // Generate randomness
        uint256 random = _generateRandom(fid);
        
        // Check lucky burst first
        bool isLuckyBurst = (random % luckyBurstChance) == 0;
        
        if (isLuckyBurst && luckyBurstBalance >= LUCKY_BURST_MIN) {
            uint256 prize = LUCKY_BURST_MIN;
            if (prize > luckyBurstBalance) prize = luckyBurstBalance;
            
            luckyBurstBalance -= prize;
            payable(msg.sender).transfer(prize);
            
            // Still roll dice for display
            uint8 dice1 = uint8((random % 6) + 1);
            uint8 dice2 = uint8(((random / 6) % 6) + 1);
            
            emit LuckyBurstWon(fid, prize, false, "dice");
            emit DicePlayed(fid, dice1, dice2, dice1 + dice2, true, prize, true);
            
            return DiceResult({
                dice1: dice1,
                dice2: dice2,
                total: dice1 + dice2,
                isWin: true,
                prizeAmount: prize,
                isLuckyBurst: true,
                isTRIA: false
            });
        }
        
        // Roll dice
        uint8 dice1 = uint8((random % 6) + 1);
        uint8 dice2 = uint8(((random / 6) % 6) + 1);
        uint8 total = dice1 + dice2;
        
        // Determine win and multiplier
        uint256 multiplier = 0;
        bool isWin = false;
        
        if (total == 7) {
            // Lucky seven
            multiplier = 2;
            isWin = true;
        } else if (total == 2 || total == 12) {
            // Snake eyes or boxcars
            multiplier = 5;
            isWin = true;
        } else if (dice1 == dice2) {
            // Doubles
            multiplier = 3;
            isWin = true;
        }
        
        uint256 prize = 0;
        
        if (isWin && miniGameBalance > 0) {
            prize = (MINI_GAME_COST * multiplier * MINI_PRIZE_ALLOCATION) / 100;
            
            if (prize > miniGameBalance) prize = miniGameBalance;
            
            if (prize > 0) {
                miniGameBalance -= prize;
                payable(msg.sender).transfer(prize);
            }
        }
        
        emit DicePlayed(fid, dice1, dice2, total, isWin, prize, false);
        
        return DiceResult({
            dice1: dice1,
            dice2: dice2,
            total: total,
            isWin: isWin,
            prizeAmount: prize,
            isLuckyBurst: false,
            isTRIA: false
        });
    }
    
    /**
     * @notice Play Ether Spin - Roulette style (0-36)
     * @dev Win conditions:
     *      - Green (0): 35x prize
     *      - Exact number match: 10x prize
     *      - Color match (red/black): 1.5x prize
     *      - Lucky burst: 1:500 for 0.001 ETH
     */
    function playSpin(uint256 fid, uint8 betNumber, string memory betColor) external payable returns (SpinResult memory) {
        if (msg.value != MINI_GAME_COST) {
            revert InvalidAmount();
        }
        
        if (betNumber > 36) {
            revert InvalidAmount();
        }
        
        // Anti-spam
        if (block.timestamp < lastMiniGamePlay[msg.sender] + 1) {
            revert TooSoon();
        }
        lastMiniGamePlay[msg.sender] = block.timestamp;
        
        // Process entry fee
        _processMiniGameEntry();
        
        fidMiniGamePlays[fid]++;
        
        // Generate randomness
        uint256 random = _generateRandom(fid);
        
        // Check lucky burst first
        bool isLuckyBurst = (random % luckyBurstChance) == 0;
        
        if (isLuckyBurst && luckyBurstBalance >= LUCKY_BURST_MIN) {
            uint256 prize = LUCKY_BURST_MIN;
            if (prize > luckyBurstBalance) prize = luckyBurstBalance;
            
            luckyBurstBalance -= prize;
            payable(msg.sender).transfer(prize);
            
            // Still spin for display
            uint8 number = uint8(random % 37);
            string memory color = _getSpinColor(number);
            
            emit LuckyBurstWon(fid, prize, false, "spin");
            emit SpinPlayed(fid, number, color, true, prize, 100, true);
            
            return SpinResult({
                number: number,
                color: color,
                isWin: true,
                prizeAmount: prize,
                multiplier: 100,
                isLuckyBurst: true,
                isTRIA: false
            });
        }
        
        // Spin the wheel
        uint8 number = uint8(random % 37); // 0-36
        string memory color = _getSpinColor(number);
        
        // Determine win and multiplier
        uint256 multiplier = 0;
        bool isWin = false;
        
        if (number == 0 && betNumber == 0) {
            // Green zero hit
            multiplier = 35;
            isWin = true;
        } else if (number == betNumber && number != 0) {
            // Exact number match
            multiplier = 10;
            isWin = true;
        } else if (keccak256(bytes(color)) == keccak256(bytes(betColor)) && number != 0) {
            // Color match
            multiplier = 15; // 1.5x (will divide by 10)
            isWin = true;
        }
        
        uint256 prize = 0;
        
        if (isWin && miniGameBalance > 0) {
            prize = (MINI_GAME_COST * multiplier * MINI_PRIZE_ALLOCATION) / 1000; // Divide by 1000 for decimal support
            
            if (prize > miniGameBalance) prize = miniGameBalance;
            
            if (prize > 0) {
                miniGameBalance -= prize;
                payable(msg.sender).transfer(prize);
            }
        }
        
        emit SpinPlayed(fid, number, color, isWin, prize, multiplier, false);
        
        return SpinResult({
            number: number,
            color: color,
            isWin: isWin,
            prizeAmount: prize,
            multiplier: multiplier,
            isLuckyBurst: false,
            isTRIA: false
        });
    }
    
    // ============================================
    // OWNER FUNCTIONS
    // ============================================
    
    function withdrawBuyback() external onlyOwner {
        uint256 amount = buybackTRIABalance + miniBuybackTRIABalance;
        if (amount == 0) revert InsufficientBalance();
        
        buybackTRIABalance = 0;
        miniBuybackTRIABalance = 0;
        
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
    
    function withdrawMiniMaintenance() external onlyOwner {
        uint256 amount = miniMaintenanceBalance;
        if (amount == 0) revert InsufficientBalance();
        
        miniMaintenanceBalance = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert InsufficientBalance();
    }
    
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
    
    function setLuckyBurstChance(uint256 newChance) external onlyOwner {
        luckyBurstChance = newChance;
    }
    
    function setBackendServer(address newBackend) external onlyOwner {
        backendServer = newBackend;
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
        
        return (weightedScore * prizePool) / totalWeighted;
    }
    
    function _processMiniGameEntry() internal {
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
        
        // Lucky burst pool
        uint256 luckyContribution = (prizeETH * LUCKY_BURST_ALLOCATION) / 100;
        luckyBurstBalance += luckyContribution;
    }
    
    /**
     * @notice Generate pseudo-random number using blockhash
     * @dev For production, upgrade to Chainlink VRF for true randomness
     */
    function _generateRandom(uint256 fid) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            block.number,
            fid,
            msg.sender,
            fidMiniGamePlays[fid]
        )));
    }
    
    /**
     * @notice Get color for spin number (roulette style)
     * @dev 0 = green, 1-10 = alternating red/black, 11-18 = alternating black/red, etc.
     */
    function _getSpinColor(uint8 number) internal pure returns (string memory) {
        if (number == 0) return "green";
        
        // Roulette color pattern
        uint8[18] memory redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        
        for (uint256 i = 0; i < redNumbers.length; i++) {
            if (number == redNumbers[i]) return "red";
        }
        
        return "black";
    }
    
    receive() external payable {}
}
