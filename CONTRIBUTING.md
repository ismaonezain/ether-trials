hahaha
# 🤝 Contributing to Ether Trials

Thank you for your interest in contributing to Ether Trials! We welcome contributions from the community.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Smart Contract Changes](#smart-contract-changes)
- [Documentation](#documentation)

---

## 📜 Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Expected Behavior
- ✅ Use welcoming and inclusive language
- ✅ Be respectful of differing viewpoints
- ✅ Accept constructive criticism gracefully
- ✅ Focus on what's best for the community
- ✅ Show empathy towards other community members

### Unacceptable Behavior
- ❌ Trolling, insulting, or derogatory comments
- ❌ Personal or political attacks
- ❌ Public or private harassment
- ❌ Publishing others' private information
- ❌ Other conduct deemed unprofessional

---

## 🎯 How Can I Contribute?

### 🐛 Reporting Bugs
Found a bug? Help us improve by reporting it!

**Before submitting:**
- Check existing issues to avoid duplicates
- Test on latest version
- Gather reproduction steps

**Create an issue with:**
- Clear, descriptive title
- Detailed description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Environment details (browser, OS, wallet)

### 💡 Suggesting Features
Have an idea? We'd love to hear it!

**Feature requests should include:**
- Clear use case
- Benefits to users
- Potential implementation approach
- Any drawbacks or considerations

### 📝 Documentation Improvements
Documentation is crucial! Help by:
- Fixing typos and grammar
- Clarifying confusing sections
- Adding examples
- Translating to other languages
- Improving code comments

### 💻 Code Contributions
Ready to code? Awesome!

**Good first issues:**
- Look for `good-first-issue` label
- UI/UX improvements
- Test coverage
- Bug fixes
- Performance optimizations

---

## 🛠️ Development Setup

### Prerequisites
```bash
Node.js 18+
npm or yarn
Git
MetaMask or compatible wallet
```

### Initial Setup
```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/ether-trials.git
cd ether-trials

# 3. Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/ether-trials.git

# 4. Install dependencies
npm install

# 5. Copy environment template
cp .env.example .env

# 6. Add your environment variables
# Edit .env with your keys

# 7. Run development server
npm run dev

# 8. Open browser
# Visit: http://localhost:3000
```

### Keeping Your Fork Updated
```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream main into your main
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

---

## 🔄 Pull Request Process

### 1. Create a Branch
```bash
# Create feature branch from main
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Adding tests

### 2. Make Your Changes
- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed
- Add tests for new features

### 3. Test Your Changes
```bash
# Run linter
npm run lint

# Run tests (if available)
npm run test

# Build to check for errors
npm run build

# Test manually
npm run dev
```

### 4. Commit Your Changes
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add dice roll animation"
```

**Commit message format:**
```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style (formatting, etc)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

**Examples:**
```
feat: add lucky burst visual effect
fix: resolve wallet connection issue on mobile
docs: update deployment guide with V3 info
refactor: optimize game render loop
```

### 5. Push to Your Fork
```bash
git push origin feature/your-feature-name
```

### 6. Create Pull Request
1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Fill in the PR template
4. Link related issues
5. Request review

### 7. PR Review Process
- Maintainers will review your PR
- Address feedback promptly
- Make requested changes
- Push additional commits
- Once approved, PR will be merged

---

## 🎨 Coding Standards

### TypeScript
```typescript
// ✅ Good: Explicit types
function calculateReward(score: number, weight: bigint): bigint {
  return BigInt(score) * weight;
}

// ❌ Bad: Implicit any
function calculateReward(score, weight) {
  return score * weight;
}

// ✅ Good: Interface for complex types
interface Player {
  fid: bigint;
  score: number;
  entryAmount: bigint;
  wallets: string[];
}

// ❌ Bad: Any type
const player: any = { ... };
```

### React Components
```typescript
// ✅ Good: Type props, use hooks properly
import type { FC } from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: FC<ButtonProps> = ({ label, onClick, disabled }) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

// ❌ Bad: No types, unclear props
export const Button = (props) => {
  return <button {...props} />;
};
```

### Smart Contracts
```solidity
// ✅ Good: Clear naming, comments, checks
/// @notice Submit game score with commit/reveal
/// @param fid Farcaster ID of player
/// @param scoreHash Keccak256 hash of score + nonce
function commitScore(uint256 fid, bytes32 scoreHash) external {
    if (commitments[fid].timestamp != 0) revert AlreadyCommitted();
    commitments[fid] = Commitment({
        hash: scoreHash,
        timestamp: block.timestamp
    });
    emit ScoreCommitted(fid, scoreHash);
}

// ❌ Bad: No comments, unclear logic
function submit(uint256 f, bytes32 h) external {
    data[f] = h;
}
```

### File Organization
```
src/
├── app/              # Next.js app router
├── components/       # React components
│   ├── game/        # Game-specific components
│   ├── ui/          # Reusable UI components
│   └── admin/       # Admin components
├── hooks/           # Custom React hooks
├── lib/             # Utilities and helpers
│   ├── game/        # Game logic
│   └── contracts/   # Contract ABIs
├── contracts/       # Smart contracts & docs
└── types/           # TypeScript type definitions
```

---

## 🔐 Smart Contract Changes

### Security First
Smart contract changes require extra scrutiny:

**Before submitting:**
- ✅ Test thoroughly on testnet
- ✅ Add comprehensive tests
- ✅ Document all functions
- ✅ Consider edge cases
- ✅ Check for reentrancy
- ✅ Validate all inputs
- ✅ Handle errors gracefully

**Breaking changes:**
- Smart contract changes are often breaking
- Clearly mark as breaking change
- Provide migration guide
- Update documentation

**Testing checklist:**
```solidity
// ✅ Test normal cases
// ✅ Test edge cases (0, max values)
// ✅ Test unauthorized access
// ✅ Test reentrancy protection
// ✅ Test gas limits
// ✅ Test with different FIDs
// ✅ Test period boundaries
```

---

## 📚 Documentation

### When to Update Docs
Update documentation when you:
- Add new features
- Change existing behavior
- Fix bugs that affect usage
- Improve performance significantly

### Documentation Standards
```markdown
# ✅ Good: Clear, structured, examples

## Feature Name

### Overview
Brief description of what it does.

### Usage
```typescript
// Code example with comments
const result = await contract.someFunction(param);
```

### Parameters
- `param` (type) - Description

### Returns
- `type` - Description

### Example
Complete working example.

# ❌ Bad: Unclear, no examples
## Thing
It does stuff.
```

---

## ✅ Checklist Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Build succeeds without errors
- [ ] Documentation updated (if needed)
- [ ] Commit messages are clear
- [ ] Branch is up to date with main
- [ ] No merge conflicts
- [ ] PR description is complete
- [ ] Linked related issues
- [ ] Requested appropriate reviewers

---

## 🎓 Resources

### Learning Resources
- **TypeScript**: https://www.typescriptlang.org/docs/
- **React**: https://react.dev
- **Next.js**: https://nextjs.org/docs
- **Solidity**: https://docs.soliditylang.org
- **Base**: https://docs.base.org
- **Farcaster**: https://docs.farcaster.xyz

### Development Tools
- **Remix IDE**: https://remix.ethereum.org
- **Hardhat**: https://hardhat.org
- **Wagmi**: https://wagmi.sh
- **Viem**: https://viem.sh

---

## 🏆 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in commit history
- Appreciated by the community! 🙏

---

## 📞 Questions?

- **Discussions**: GitHub Discussions
- **Discord**: [Join Community](https://discord.gg/ethertrials)
- **Farcaster**: [@ethertrials](https://warpcast.com/ethertrials)
- **X/Twitter**: [@EtherTrials](https://twitter.com/ethertrials)

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

**Thank you for contributing to Ether Trials! 🎮🚀**

Together, we're building the future of decentralized gaming on Base!
