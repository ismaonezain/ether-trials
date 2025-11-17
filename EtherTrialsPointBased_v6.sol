// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/IZap.sol";

contract EtherTrialsPointBased {
    
    // ... other functions and variables ...

    function _swapETHToTRIAV4(uint256 amountInETH, address targetToken, address recipient) external payable {
        require(msg.value == amountInETH, "Incorrect ETH amount sent");
        require(targetToken != address(0), "Invalid target token");
        
        // Define the v4Actions: SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
        bytes v4Actions = hex"060403";
        
        // Prepare v4Params
        bytes[] memory v4Params = new bytes[](3);
        v4Params[0] = abi.encode(targetToken, amountInETH, recipient);
        v4Params[1] = abi.encode(...); // Define the parameters specific to SETTLE_ALL action
        v4Params[2] = abi.encode(...); // Define the parameters specific to TAKE_ALL action
        
        // Encode inputs
        bytes memory inputs = abi.encode(v4Actions, v4Params);
        
        // Call the V4_SWAP command using the IZap interface
        IZap zap = IZap(yourZapAddress);
        zap.V4_SWAP{value: msg.value}(inputs);
    }

    // ... other functions ...
}