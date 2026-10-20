// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WeWise ProofRegistry
/// @notice Append-only registry of salted references and Merkle roots. It never stores personal data,
///         amounts or files, and it has no payable or transfer function: it proves facts, it never moves money.
contract ProofRegistry {
    /// kind: 1 = claim package, 2 = consent record, 3 = agent audit batch
    struct Proof { bytes32 root; uint8 kind; uint64 anchoredAt; address submitter; }

    address public admin;
    mapping(address => bool) public submitters;
    mapping(bytes32 => Proof[]) private history;

    event Anchored(bytes32 indexed ref, bytes32 root, uint8 kind, uint256 version, address submitter);
    event SubmitterSet(address indexed submitter, bool allowed);

    modifier onlyAdmin() { require(msg.sender == admin, "not admin"); _; }
    modifier onlySubmitter() { require(submitters[msg.sender], "not submitter"); _; }

    constructor() {
        admin = msg.sender;
        submitters[msg.sender] = true;
        emit SubmitterSet(msg.sender, true);
    }

    function setSubmitter(address who, bool allowed) external onlyAdmin {
        submitters[who] = allowed;
        emit SubmitterSet(who, allowed);
    }

    function anchor(bytes32 ref, bytes32 root, uint8 kind) external onlySubmitter returns (uint256 version) {
        require(root != bytes32(0), "empty root");
        require(kind >= 1 && kind <= 3, "bad kind");
        history[ref].push(Proof(root, kind, uint64(block.timestamp), msg.sender));
        version = history[ref].length;
        emit Anchored(ref, root, kind, version, msg.sender);
    }

    function versions(bytes32 ref) external view returns (uint256) { return history[ref].length; }

    function proofAt(bytes32 ref, uint256 version) external view returns (Proof memory) {
        require(version >= 1 && version <= history[ref].length, "no such version");
        return history[ref][version - 1];
    }

    /// @return found whether root was ever anchored under ref, version its 1-based version, latest the newest version
    function verify(bytes32 ref, bytes32 root) external view returns (bool found, uint256 version, uint256 latest) {
        Proof[] storage list = history[ref];
        latest = list.length;
        for (uint256 i = list.length; i > 0; i--) {
            if (list[i - 1].root == root) return (true, i, latest);
        }
        return (false, 0, latest);
    }
}
