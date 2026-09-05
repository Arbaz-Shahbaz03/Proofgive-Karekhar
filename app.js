const ADMIN_PASSCODE = "karsekhar-admin"; // change this before sharing the repo publicly

const { Connection, PublicKey, Transaction, SystemProgram, clusterApiUrl } = solanaWeb3;

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

let wallet = null;

const connectBtn = document.getElementById("connectBtn");
const donateBtn = document.getElementById("donateBtn");
const distributeBtn = document.getElementById("distributeBtn");
const refreshBtn = document.getElementById("refreshBtn");

// --- view switching ---
const publicViewBtn = document.getElementById("publicViewBtn");
const adminViewBtn = document.getElementById("adminViewBtn");
const publicView = document.getElementById("publicView");
const adminView = document.getElementById("adminView");

function showPublic() {
  publicView.classList.remove("hidden");
  adminView.classList.add("hidden");
  publicViewBtn.classList.add("active");
  adminViewBtn.classList.remove("active");
}

function showAdmin() {
  const entered = prompt("Admin passcode:");
  if (entered !== ADMIN_PASSCODE) {
    if (entered !== null) alert("Wrong passcode.");
    return;
  }
  publicView.classList.add("hidden");
  adminView.classList.remove("hidden");
  adminViewBtn.classList.add("active");
  publicViewBtn.classList.remove("active");
}

publicViewBtn.addEventListener("click", showPublic);
adminViewBtn.addEventListener("click", showAdmin);

function setStatus(elId, msg, isError = false) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

function memoInstruction(text, signerPubkey) {
  return new solanaWeb3.TransactionInstruction({
    keys: [{ pubkey: signerPubkey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: new TextEncoder().encode(text),
  });
}

async function sha256Hex(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function connectWallet() {
  if (!window.solana || !window.solana.isPhantom) {
    alert("Phantom wallet not found. Install it from phantom.app, switch it to Devnet, and reload.");
    return;
  }
  try {
    const resp = await window.solana.connect();
    wallet = resp.publicKey;
    connectBtn.textContent = wallet.toBase58().slice(0, 4) + "…" + wallet.toBase58().slice(-4);
    connectBtn.classList.add("btn-outline");
  } catch (err) {
    console.error(err);
  }
}

async function sendDonation() {
  const ngoAddressStr = document.getElementById("ngoAddress").value.trim();
  const campaign = document.getElementById("campaign").value.trim() || "General";
  const amountSol = parseFloat(document.getElementById("amount").value);

  if (!wallet) return setStatus("donateStatus", "Connect your wallet first.", true);
  if (!ngoAddressStr) return setStatus("donateStatus", "Paste the NGO's wallet address.", true);
  if (!amountSol || amountSol <= 0) return setStatus("donateStatus", "Enter an amount greater than 0.", true);

  let ngoPubkey;
  try {
    ngoPubkey = new PublicKey(ngoAddressStr);
  } catch {
    return setStatus("donateStatus", "That doesn't look like a valid Solana address.", true);
  }

  donateBtn.disabled = true;
  setStatus("donateStatus", "Building transaction…");

  try {
    const lamports = Math.round(amountSol * solanaWeb3.LAMPORTS_PER_SOL);
    const memoPayload = JSON.stringify({
      type: "donation",
      campaign,
      note: "ProofGive submission",
    });

    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: wallet, toPubkey: ngoPubkey, lamports }),
      memoInstruction(memoPayload, wallet)
    );
    tx.feePayer = wallet;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    setStatus("donateStatus", "Waiting for wallet approval…");
    const { signature } = await window.solana.signAndSendTransaction(tx);
    setStatus("donateStatus", "Confirming on-chain…");
    await connection.confirmTransaction(signature, "confirmed");
    setStatus("donateStatus", "Donation recorded ✓ " + signature.slice(0, 8) + "…");
    document.getElementById("amount").value = "";
    loadLedger(ngoAddressStr);
  } catch (err) {
    console.error(err);
    setStatus("donateStatus", "Transaction failed — see console.", true);
  } finally {
    donateBtn.disabled = false;
  }
}

async function postDistributionProof() {
  const ngoAddressStr = document.getElementById("ngoAddress").value.trim();
  const batchLabel = document.getElementById("batchLabel").value.trim() || "Distribution batch";
  const beneficiaryCount = document.getElementById("beneficiaryCount").value.trim();
  const totalDistributed = document.getElementById("totalDistributed").value.trim();
  const privateNotes = document.getElementById("privateNotes").value;

  if (!wallet) return setStatus("distributeStatus", "Connect your wallet first.", true);
  if (!beneficiaryCount || !totalDistributed) {
    return setStatus("distributeStatus", "Fill in beneficiary count and total distributed.", true);
  }

  distributeBtn.disabled = true;
  setStatus("distributeStatus", "Hashing allocation locally…");

  try {
    const allocationHash = await sha256Hex(
      `${batchLabel}|${beneficiaryCount}|${totalDistributed}|${privateNotes}`
    );

    const memoPayload = JSON.stringify({
      type: "distribution_proof",
      batchLabel,
      beneficiaryCount: Number(beneficiaryCount),
      totalDistributed: Number(totalDistributed),
      allocationHash,
    });

    const tx = new Transaction().add(memoInstruction(memoPayload, wallet));
    tx.feePayer = wallet;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    setStatus("distributeStatus", "Waiting for wallet approval…");
    const { signature } = await window.solana.signAndSendTransaction(tx);
    setStatus("distributeStatus", "Confirming on-chain…");
    await connection.confirmTransaction(signature, "confirmed");
    setStatus("distributeStatus", "Proof posted ✓ " + signature.slice(0, 8) + "…");

    document.getElementById("privateNotes").value = "";
    if (ngoAddressStr) loadLedger(ngoAddressStr);
  } catch (err) {
    console.error(err);
    setStatus("distributeStatus", "Transaction failed — see console.", true);
  } finally {
    distributeBtn.disabled = false;
  }
}

function explorerLink(signature) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function parseMemoFromTx(parsedTx) {
  const ixs = parsedTx?.transaction?.message?.instructions || [];
  for (const ix of ixs) {
    const isMemoProgram =
      ix.program === "spl-memo" || ix.programId?.toBase58?.() === MEMO_PROGRAM_ID.toBase58();
    if (isMemoProgram && typeof ix.parsed === "string") {
      try {
        return JSON.parse(ix.parsed);
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function loadLedger(ngoAddressOverride) {
  const ngoAddressStr = ngoAddressOverride || document.getElementById("ngoAddress").value.trim();
  const tbody = document.getElementById("ledgerBody");

  if (!ngoAddressStr) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Enter an NGO address above to load its ledger.</td></tr>`;
    return;
  }

  let pubkey;
  try {
    pubkey = new PublicKey(ngoAddressStr);
  } catch {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Invalid address.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Loading from chain…</td></tr>`;

  try {
    const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 25 });
    let totalReceived = 0;
    let totalDistributedOut = 0;
    let proofCount = 0;
    const rows = [];

    for (const sigInfo of sigs) {
      const parsedTx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!parsedTx) continue;
      const memo = parseMemoFromTx(parsedTx);
      if (!memo) continue;

      if (memo.type === "donation") {
        const transferIx = (parsedTx.transaction.message.instructions || []).find(
          (ix) => ix.parsed?.type === "transfer" && ix.parsed?.info?.destination === ngoAddressStr
        );
        const sol = transferIx ? transferIx.parsed.info.lamports / solanaWeb3.LAMPORTS_PER_SOL : 0;
        totalReceived += sol;
        rows.push({
          type: "Donation",
          detail: memo.campaign || "General",
          amount: sol.toFixed(4) + " SOL",
          sig: sigInfo.signature,
        });
      } else if (memo.type === "distribution_proof") {
        totalDistributedOut += Number(memo.totalDistributed) || 0;
        proofCount += 1;
        rows.push({
          type: "Distribution proof",
          detail: `${memo.batchLabel} · ${memo.beneficiaryCount} beneficiaries · hash ${memo.allocationHash?.slice(0, 10)}…`,
          amount: Number(memo.totalDistributed).toFixed(4) + " SOL",
          sig: sigInfo.signature,
        });
      }
    }

    document.getElementById("totalReceived").textContent = totalReceived.toFixed(4) + " SOL";
    document.getElementById("totalDistributedOut").textContent = totalDistributedOut.toFixed(4) + " SOL";
    document.getElementById("proofCount").textContent = proofCount;

    tbody.innerHTML = rows.length
      ? rows
          .map(
            (r) => `<tr>
              <td>${r.type}</td>
              <td>${r.detail}</td>
              <td>${r.amount}</td>
              <td><a href="${explorerLink(r.sig)}" target="_blank" rel="noopener">View ↗</a></td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="empty-row">No ProofGive activity found for this address yet.</td></tr>`;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Couldn't load ledger — see console.</td></tr>`;
  }
}

connectBtn.addEventListener("click", connectWallet);
donateBtn.addEventListener("click", sendDonation);
distributeBtn.addEventListener("click", postDistributionProof);
refreshBtn.addEventListener("click", () => loadLedger());
