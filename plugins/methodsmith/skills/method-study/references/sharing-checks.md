# Sharing and Git boundary

1. Confirm the destination and approved disclosure scope. `.gitignore` does not protect tracked content, and a private GitHub repository does not establish authorization.
2. Inspect the exact staged blobs, not only working files. Use `git diff --cached --name-status` for inventory, then inspect candidate content only inside the approved environment. Do not paste sensitive diff text into chat or ordinary logs.
3. Check notebook cells/outputs/attachments, images and metadata, rendered HTML, spreadsheets, model artifacts, filenames and document properties. Extension checks or secret scanners alone cannot establish absence of patient-level content. Unknown classification blocks export until reviewed.
4. Review all newly exposed commits relative to the actual destination ref, not only the final tree. If the destination or history cannot be established, do not assert a safe push. Never rewrite history automatically.
5. Produce sanitized copies without replacing protected originals. Bind disclosure review to the exact byte digests and candidate ref. Recheck if staging or history changes; preserve unrelated staged work.
6. Use the host's enforced hooks where available, while naming instruction-only or unavailable checks. Outside these helper workflows, users can still run Git directly; this plugin is not a sandbox.

Use `scripts/git_disclosure.py --repo PROJECT --base DESTINATION_REF` to fingerprint the complete index and outgoing object set without displaying filenames or contents. It exits blocked until a protected approval JSON supplies matching `inventory_digest`, actual human `reviewer` and `timestamp`; pass that file via `--approval`. Review actual content privately before writing this approval. Re-run immediately before the Git action; any intervening index/HEAD/base change invalidates the review. A result without `--base` covers staging only, never a push. A caller can bypass this tool; it is not a hook or identity service.
