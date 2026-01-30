kokok
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherTrials TRIA v4 - Sustainable & Player-Submitted Scores
 * @notice Tournament with anti-cheat + Sustainable mini games (only active when pool funded)
 * @dev Player submit scores themselves with commitment scheme to prevent cheating
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

contract EtherTrialsTRIAv4 {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    address public owner;
    address public immutable triaToken;
    IUniswapV2Router public immutable uniswapRouter;
    
    // Timing
    uint256 public constant PERIOD_DURATION = 24 hours;
    uint256 public constant WALLET_ADD_COOLDOWN = 7 days;
    uint256 public constant SCORE_REVEAL_WINDOW = 10 minutes;
    
    // Entry limits
    uint256 public constant MIN_ENTRY = 0.00001 ether;
    uint256 public constant MAX_ENTRY = 1 ether;
    uint256 public constant MAX_WALLETS_PER_FID = 3;
    uint256 public constant MINI_GAME_COST = 0.00001 ether;
    uint256 public constant MINI_GAME_THRESHOLD = 0.01 ether; // Min balance for mini games
    
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
    uint256 public constant LUCKY_BURST_ALLOCATION = 10;    // 10% of mini prizes
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
        uint256 totalWeightedScore;
    }
    
    struct Entry {
        uint256 entryAmountETH;
        uint256 entryWeight;
        uint256 timestamp;
        bool exists;
    }
    
    // Commitment scheme for anti-cheat
    struct ScoreCommitment {
        bytes32 commitHash;
        uint256 commitTime;
        uint256 score;
        bool revealed;
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
    }
    
    struct SpinResult {
        uint8 number;
        bool isWin;
        uint256 prizeAmount;
        uint256 multiplier;
        bool isLuckyBurst;
    }
    
    // ============================================
    // MAPPINGS
    // ============================================
    
    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(uint256 => Entry)) public entries;
    mapping(uint256 => mapping(uint256 => ScoreCommitment)) public scoreCommitments;
    mapping(uint256 => FIDProfile) private fidProfiles;
    mapping(uint256 => mapping(uint256 => ClaimStatus)) public claimStatus;
    
    // Mini game tracking
    mapping(uint256 => uint256) public fidMiniGamePlays;
    mapping(address => uint256) public lastMiniGamePlay;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event TournamentEntry(uint256 indexed period, uint256 indexed fid, uint256 ethAmount, uint256 triaReceived, uint256 weight);
    event ScoreCommitted(uint256 indexed period, uint256 indexed fid, bytes32 commitHash);
    event ScoreRevealed(uint256 indexed period, uint256 indexed fid, uint256 score);
    event PeriodFinalized(uint256 indexed period, uint256 triaPool, uint256 totalWeightedScore);
    event RewardsClaimed(uint256 indexed period, uint256 indexed fid, address claimer, uint256 triaAmount);
    event WalletAdded(uint256 indexed fid, address wallet);
    event WalletRemoved(uint256 indexed fid, address wallet);
    event BuybackWithdrawn(address owner, uint256 triaAmount);
    event TreasuryWithdrawn(address owner, uint256 ethAmount);
    
    // Onchain game events
    event DicePlayed(uint256 indexed fid, uint8 dice1, uint8 dice2, uint8 total, bool isWin, uint256 prize, bool isLuckyBurst);
    event SpinPlayed(uint256 indexed fid, uint8 number, bool isWin, uint256 prize, uint256 multiplier, bool isLuckyBurst);
    event LuckyBurstWon(uint256 indexed fid, uint256 prize, string gameType);
    
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
    error AlreadyCommitted();
    error NotCommitted();
    error RevealWindowExpired();
    error InvalidReveal();
    error MiniGameInactive();
    
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
        
        // Auto-add first wallet or check approval
        if (fidProfiles[fid].approvedWallets.length == 0) {
            _addWalletInternal(fid, msg.sender);
        } else {
            if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
                revert WalletNotApproved();
            }
        }
        
        // Calculate allocations - 100% swap to TRIA
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
        
        // Calculate entry weight (0.00001 ETH = 1, 1 ETH = 100,000)
        uint256 weight = (msg.value * 1e18) / MIN_ENTRY;
        
        entries[period][fid] = Entry({
            entryAmountETH: msg.value,
            entryWeight: weight,
            timestamp: block.timestamp,
            exists: true
        });
        
        fidProfiles[fid].totalEntriesAllTime++;
        
        emit TournamentEntry(period, fid, msg.value, prizePoolTRIA, weight);
    }
    
    /**
     * @notice Commit score hash (step 1 of anti-cheat)
     * @dev Player commits keccak256(fid, score, nonce, timestamp)
     */
    function commitScore(uint256 period, uint256 fid, bytes32 commitHash) external {
        if (!entries[period][fid].exists) {
            revert NoEntry();
        }
        
        if (!fidProfiles[fid].isWalletApproved[msg.sender]) {
            revert WalletNotApproved();
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
        
        if (period == currentPeriod) {
            currentPeriod++;
            periods[currentPeriod].startTime = block.timestamp;
            periods[currentPeriod].endTime = block.timestamp + PERIOD_DURATION;
        }
        
        emit PeriodFinalized(period, periods[period].triaPool, periods[period].totalWeightedScore);
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
    // SUSTAINABLE MINI GAMES (Only Active When Funded)
    // ============================================
    
    /**
     * @notice Check if mini games are active
     * @dev Only active when balance >= threshold
     */
    function areMiniGamesActive() public view returns (bool) {
        return miniGameBalance >= MINI_GAME_THRESHOLD;
    }
    
    /**
     * @notice Play Ether Dice - PROPER HOUSE EDGE!
     * @dev Win conditions (House edge ~40%):
     *      - Sum = 7: 4x (6/36 = 16.67%)
     *      - Snake eyes (2): 20x (1/36 = 2.78%)
     *      - Boxcars (12): 20x (1/36 = 2.78%)
     *      - Other doubles: 3x (4/36 = 11.11%)
     *      - LOSE: Everything else (24/36 = 66.67%)
     *      - Lucky burst: 1:500 for 0.001 ETH
     */
    function playDice(uint256 fid) external payable returns (DiceResult memory) {
        if (!areMiniGamesActive()) {
            revert MiniGameInactive();
        }
        
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
        
        // Declare variables at function level to avoid shadowing
        uint8 dice1;
        uint8 dice2;
        uint256 prize = 0;
        
        // Check lucky burst first
        bool isLuckyBurst = (random % luckyBurstChance) == 0;
        
        if (isLuckyBurst && luckyBurstBalance >= LUCKY_BURST_MIN) {
            prize = LUCKY_BURST_MIN;
            if (prize > luckyBurstBalance) prize = luckyBurstBalance;
            
            luckyBurstBalance -= prize;
            payable(msg.sender).transfer(prize);
            
            dice1 = uint8((random % 6) + 1);
            dice2 = uint8(((random / 6) % 6) + 1);
            
            emit LuckyBurstWon(fid, prize, "dice");
            emit DicePlayed(fid, dice1, dice2, dice1 + dice2, true, prize, true);
            
            return DiceResult({
                dice1: dice1,
                dice2: dice2,
                total: dice1 + dice2,
                isWin: true,
                prizeAmount: prize,
                isLuckyBurst: true
            });
        }
        
        // Roll dice
        dice1 = uint8((random % 6) + 1);
        dice2 = uint8(((random / 6) % 6) + 1);
        uint8 total = dice1 + dice2;
        
        // Determine win and multiplier
        uint256 multiplier = 0;
        bool isWin = false;
        
        if (total == 7) {
            multiplier = 4;
            isWin = true;
        } else if (total == 2 || total == 12) {
            multiplier = 20;
            isWin = true;
        } else if (dice1 == dice2 && total != 2 && total != 12) {
            multiplier = 3;
            isWin = true;
        }
        // Else: LOSE!
        
        if (isWin && miniGameBalance > 0) {
            // Prize from pool, with multiplier
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
            isLuckyBurst: false
        });
    }
    
    /**
     * @notice Play Ether Spin - PROPER HOUSE EDGE!
     * @dev Win conditions (House edge ~60%):
     *      - Exact match 0 (green): 20x (1/37 = 2.7%)
     *      - Exact match 1-36: 8x (1/37 = 2.7%)
     *      - LOSE: Everything else (35/37 = 94.6%)
     *      - Lucky burst: 1:500 for 0.001 ETH
     */
    function playSpin(uint256 fid, uint8 betNumber) external payable returns (SpinResult memory) {
        if (!areMiniGamesActive()) {
            revert MiniGameInactive();
        }
        
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
        
        // Declare variables at function level to avoid shadowing
        uint8 number;
        uint256 prize = 0;
        
        // Check lucky burst first
        bool isLuckyBurst = (random % luckyBurstChance) == 0;
        
        if (isLuckyBurst && luckyBurstBalance >= LUCKY_BURST_MIN) {
            prize = LUCKY_BURST_MIN;
            if (prize > luckyBurstBalance) prize = luckyBurstBalance;
            
            luckyBurstBalance -= prize;
            payable(msg.sender).transfer(prize);
            
            number = uint8(random % 37);
            
            emit LuckyBurstWon(fid, prize, "spin");
            emit SpinPlayed(fid, number, true, prize, 100, true);
            
            return SpinResult({
                number: number,
                isWin: true,
                prizeAmount: prize,
                multiplier: 100,
                isLuckyBurst: true
            });
        }
        
        // Spin the wheel (0-36)
        number = uint8(random % 37);
        
        // Determine win and multiplier
        uint256 multiplier = 0;
        bool isWin = false;
        
        if (number == betNumber) {
            if (number == 0) {
                multiplier = 20; // Green zero
            } else {
                multiplier = 8; // Regular number
            }
            isWin = true;
        }
        // Else: LOSE!
        
        if (isWin && miniGameBalance > 0) {
            prize = (MINI_GAME_COST * multiplier * MINI_PRIZE_ALLOCATION) / 100;
            
            if (prize > miniGameBalance) prize = miniGameBalance;
            
            if (prize > 0) {
                miniGameBalance -= prize;
                payable(msg.sender).transfer(prize);
            }
        }
        
        emit SpinPlayed(fid, number, isWin, prize, multiplier, false);
        
        return SpinResult({
            number: number,
            isWin: isWin,
            prizeAmount: prize,
            multiplier: multiplier,
            isLuckyBurst: false
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
    
    function getScoreCommitment(uint256 period, uint256 fid) external view returns (
        bytes32 commitHash,
        uint256 commitTime,
        uint256 score,
        bool revealed
    ) {
        ScoreCommitment storage sc = scoreCommitments[period][fid];
        return (sc.commitHash, sc.commitTime, sc.score, sc.revealed);
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
        
        // Lucky burst pool (10% of prize allocation)
        uint256 luckyContribution = (prizeETH * LUCKY_BURST_ALLOCATION) / 100;
        luckyBurstBalance += luckyContribution;
        
        // Rest stays in mini game balance for regular prizes
        miniGameBalance += prizeETH - luckyContribution;
    }
    
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
    
    receive() external payable {}
}
