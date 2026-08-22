#!/bin/sh
set -eu

# Writes the two published image digests into one allowlisted deploys overlay.
#
# This runs inside a job that holds a write token for hannosirkel/deploys, in a
# workflow triggered by `pull_request_target`. Everything it refuses, it refuses
# because accepting it would let a promotion write something other than exactly
# two digest lines in exactly one file. `scripts/update-gitops-digest.test.ts`
# exercises every refusal below.

if [ "$#" -ne 3 ]; then
  echo 'usage: update-gitops-digest.sh sha256:BACKEND_DIGEST sha256:STOREFRONT_DIGEST OVERLAY_DIRECTORY' >&2
  exit 2
fi

backend_digest="$1"
storefront_digest="$2"
overlay_input="$3"
candidate=''
original=''
verification=''
restore_needed=0

for digest in "$backend_digest" "$storefront_digest"; do
  case "$digest" in
    sha256:????????????????????????????????????????????????????????????????) ;;
    *)
      echo 'digest update rejected: malformed digest' >&2
      exit 1
      ;;
  esac
  if ! printf '%s' "$digest" | grep -Eq '^sha256:[0-9a-f]{64}$'; then
    echo 'digest update rejected: malformed digest' >&2
    exit 1
  fi
done

# Baselined pre-existing finding, not a fix. `CDPATH=` is a deliberate empty
# assignment scoped to this one `cd`, which is how a `cd` is made to ignore an
# inherited CDPATH at all.
# shellcheck disable=SC1007
if ! overlay="$(CDPATH= cd "$overlay_input" && pwd -P)"; then
  echo 'digest update rejected: overlay is unavailable' >&2
  exit 1
fi
if ! repository="$(git -C "$overlay" rev-parse --show-toplevel 2>/dev/null)"; then
  echo 'digest update rejected: overlay is not in a Git worktree' >&2
  exit 1
fi
# Baselined pre-existing finding, not a fix. Same deliberate `CDPATH=` prefix.
# shellcheck disable=SC1007
repository="$(CDPATH= cd "$repository" && pwd -P)"
case "$overlay" in
  "$repository"/*) relative_overlay="${overlay#"$repository"/}" ;;
  *)
    echo 'digest update rejected: overlay is outside its Git worktree' >&2
    exit 1
    ;;
esac
case "$relative_overlay" in
  plepic/overlays/live|plepic/overlays/test) ;;
  *)
    echo 'digest update rejected: overlay is not permitted' >&2
    exit 1
    ;;
esac

kustomization="$overlay/kustomization.yaml"
if [ ! -f "$kustomization" ] || [ -L "$kustomization" ]; then
  echo 'digest update rejected: kustomization is unavailable' >&2
  exit 1
fi
if ! link_count="$(node -e 'process.stdout.write(String(require("node:fs").statSync(process.argv[1]).nlink))' "$kustomization")"; then
  echo 'digest update rejected: kustomization link count is unavailable' >&2
  exit 1
fi
if [ "$link_count" -ne 1 ]; then
  echo 'digest update rejected: kustomization must not be hard-linked' >&2
  exit 1
fi
if [ -n "$(git -C "$repository" status --porcelain)" ]; then
  echo 'digest update rejected: checkout is not clean' >&2
  exit 1
fi

original="$(mktemp "$overlay/.update-gitops-digest.XXXXXX")"
if ! cp -p "$kustomization" "$original"; then
  rm -f "$original"
  echo 'digest update rejected: could not snapshot kustomization' >&2
  exit 1
fi
verification="$original.verify"
if ! cp -p "$original" "$verification"; then
  rm -f "$original" "$verification"
  echo 'digest update rejected: could not verify kustomization snapshot' >&2
  exit 1
fi
if ! snapshot_hash="$(node -e 'const crypto = require("node:crypto"); const fs = require("node:fs"); process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"))' "$verification")"; then
  rm -f "$original" "$verification"
  echo 'digest update rejected: could not hash kustomization snapshot' >&2
  exit 1
fi
if ! original_inode="$(node -e 'process.stdout.write(String(require("node:fs").statSync(process.argv[1]).ino))' "$kustomization")"; then
  rm -f "$original" "$verification"
  echo 'digest update rejected: could not inspect kustomization snapshot' >&2
  exit 1
fi
# Baselined pre-existing finding, not a fix. The single quotes hold JavaScript
# for `node -e`, where a backtick template literal is the program's own syntax
# and must not be expanded by the shell.
# shellcheck disable=SC2016
if ! original_metadata="$(node -e 'const stat = require("node:fs").statSync(process.argv[1]); process.stdout.write(`${stat.mode & 0o7777}:${stat.uid}:${stat.gid}`)' "$kustomization")"; then
  rm -f "$original" "$verification"
  echo 'digest update rejected: could not inspect kustomization metadata' >&2
  exit 1
fi
candidate="$(mktemp "$overlay/.update-gitops-digest-candidate.XXXXXX")"
if ! cp -p "$original" "$candidate"; then
  rm -f "$candidate" "$original" "$verification"
  echo 'digest update rejected: could not prepare kustomization candidate' >&2
  exit 1
fi
restore_needed=0
preserve_recovery_snapshot() {
  if [ -f "$original" ] && [ ! -L "$original" ]; then
    recovery_snapshot="$original"
  else
    recovery_snapshot="$verification"
  fi
  echo "digest update rejected: recovery snapshot preserved: $recovery_snapshot" >&2
}
target_matches_original() {
  if [ ! -f "$kustomization" ] || [ -L "$kustomization" ]; then
    return 1
  fi
  if ! current_inode="$(node -e 'process.stdout.write(String(require("node:fs").statSync(process.argv[1]).ino))' "$kustomization")"; then
    return 1
  fi
  if [ "$current_inode" != "$original_inode" ]; then
    return 1
  fi
  if ! current_link_count="$(node -e 'process.stdout.write(String(require("node:fs").statSync(process.argv[1]).nlink))' "$kustomization")"; then
    return 1
  fi
  if [ "$current_link_count" != "$link_count" ]; then
    return 1
  fi
  # Baselined pre-existing finding, not a fix. Same `node -e` program as above.
  # shellcheck disable=SC2016
  if ! current_metadata="$(node -e 'const stat = require("node:fs").statSync(process.argv[1]); process.stdout.write(`${stat.mode & 0o7777}:${stat.uid}:${stat.gid}`)' "$kustomization")"; then
    return 1
  fi
  if [ "$current_metadata" != "$original_metadata" ]; then
    return 1
  fi
  if ! current_hash="$(node -e 'const crypto = require("node:crypto"); const fs = require("node:fs"); process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"))' "$kustomization")"; then
    return 1
  fi
  [ "$current_hash" = "$snapshot_hash" ]
}
restore_kustomization() {
  if [ -d "$kustomization" ]; then
    preserve_recovery_snapshot
    return 1
  fi
  if ! mv -f "$original" "$kustomization"; then
    preserve_recovery_snapshot
    return 1
  fi
  if [ -d "$kustomization" ] || [ ! -f "$kustomization" ] || [ -L "$kustomization" ]; then
    preserve_recovery_snapshot
    return 1
  fi
  if ! restored_link_count="$(node -e 'process.stdout.write(String(require("node:fs").statSync(process.argv[1]).nlink))' "$kustomization")"; then
    preserve_recovery_snapshot
    return 1
  fi
  if [ "$restored_link_count" -ne 1 ]; then
    preserve_recovery_snapshot
    return 1
  fi
  if ! restored_hash="$(node -e 'const crypto = require("node:crypto"); const fs = require("node:fs"); process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"))' "$kustomization")"; then
    preserve_recovery_snapshot
    return 1
  fi
  if [ "$restored_hash" != "$snapshot_hash" ]; then
    preserve_recovery_snapshot
    return 1
  fi
  rm -f "$verification" || true
}
cleanup() {
  status="$?"
  if [ "$restore_needed" -eq 1 ]; then
    if ! restore_kustomization; then
      status=1
    fi
  fi
  if [ "$restore_needed" -eq 0 ]; then
    rm -f "$candidate" "$original" "$verification" || true
  fi
  trap - EXIT HUP INT TERM
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

# Rewrites both digest lines and reports how many of them actually moved, so a
# re-promotion of an already-recorded pair is a no-op rather than a failure and
# the expected diff size below is derived rather than assumed.
changed_count="$(node - "$original" "$candidate" "$backend_digest" "$storefront_digest" <<'NODE'
'use strict';

const fs = require('node:fs');
const [file, candidate, backendDigest, storefrontDigest] = process.argv.slice(2);
const input = fs.readFileSync(file, 'utf8');
const images = [
  ['ghcr.io/hannosirkel/plepic-backend', backendDigest],
  ['ghcr.io/hannosirkel/plepic-storefront', storefrontDigest],
];
const digestLines = input.match(/^    digest: sha256:[0-9a-f]{64}$/gm) || [];
if (digestLines.length !== images.length) {
  process.stderr.write('digest update rejected: expected one digest per image\n');
  process.exit(1);
}
let output = input;
let changed = 0;
for (const [name, digest] of images) {
  const escaped = name.replace(/\./g, '\\.');
  const nameLines = output.match(new RegExp(`^  - name: ${escaped}$`, 'gm')) || [];
  const pattern = `^  - name: ${escaped}\\n    newName: ${escaped}\\n    digest: sha256:[0-9a-f]{64}$`;
  const matches = [...output.matchAll(new RegExp(pattern, 'gm'))];
  if (nameLines.length !== 1 || matches.length !== 1) {
    process.stderr.write('digest update rejected: expected one image entry\n');
    process.exit(1);
  }
  const block = matches[0][0];
  const replacement = block.replace(/digest: sha256:[0-9a-f]{64}$/, `digest: ${digest}`);
  if (replacement !== block) {
    changed += 1;
  }
  output = output.replace(new RegExp(pattern, 'gm'), () => replacement);
}
fs.writeFileSync(candidate, output);
process.stdout.write(String(changed));
NODE
)"

case "$changed_count" in
  0|1|2) ;;
  *)
    echo 'digest update rejected: unexpected update count' >&2
    exit 1
    ;;
esac

if ! target_matches_original; then
  echo 'digest update rejected: kustomization changed during update' >&2
  exit 1
fi

if [ "$changed_count" -eq 0 ]; then
  if ! cmp -s "$original" "$candidate"; then
    echo 'digest update rejected: unchanged update rewrote the kustomization' >&2
    exit 1
  fi
  if [ -n "$(git -C "$repository" diff --name-only)" ]; then
    echo 'digest update rejected: unchanged update modified a tracked file' >&2
    exit 1
  fi
else
  if ! mv -f "$candidate" "$kustomization"; then
    if target_matches_original; then
      restore_needed=0
    else
      restore_needed=1
    fi
    exit 1
  fi
  restore_needed=1

  changed="$(git -C "$repository" diff --name-only)"
  if [ "$changed" != "$relative_overlay/kustomization.yaml" ]; then
    echo 'digest update rejected: unexpected changed file' >&2
    exit 1
  fi

  git -C "$repository" diff --check

  expected_numstat="$(printf '%s\t%s\t%s/kustomization.yaml' \
    "$changed_count" "$changed_count" "$relative_overlay")"
  if [ "$(git -C "$repository" diff --numstat)" != "$expected_numstat" ]; then
    echo 'digest update rejected: unexpected diff size' >&2
    exit 1
  fi

  changed_lines="$(
    git -C "$repository" diff --unified=0 -- "$relative_overlay/kustomization.yaml" \
      | grep -E '^[+-]' | grep -Ev '^(---|\+\+\+)' || true
  )"
  if [ "$(printf '%s\n' "$changed_lines" | grep -c .)" -ne "$((changed_count * 2))" ]; then
    echo 'digest update rejected: unexpected changed lines' >&2
    exit 1
  fi
  if [ "$(printf '%s\n' "$changed_lines" | grep -Ec '^[-+]    digest: sha256:[0-9a-f]{64}$')" \
    -ne "$((changed_count * 2))" ]; then
    echo 'digest update rejected: non-digest line changed' >&2
    exit 1
  fi
fi

node - "$kustomization" "$backend_digest" "$storefront_digest" <<'NODE'
'use strict';

const fs = require('node:fs');
const [file, backendDigest, storefrontDigest] = process.argv.slice(2);
const input = fs.readFileSync(file, 'utf8');
const images = [
  ['ghcr.io/hannosirkel/plepic-backend', backendDigest],
  ['ghcr.io/hannosirkel/plepic-storefront', storefrontDigest],
];
const digestLines = input.match(/^    digest: sha256:[0-9a-f]{64}$/gm) || [];
if (digestLines.length !== images.length) {
  process.stderr.write('digest update rejected: replacement was not exact\n');
  process.exit(1);
}
for (const [name, digest] of images) {
  const escaped = name.replace(/\./g, '\\.');
  const block = new RegExp(
    `^  - name: ${escaped}\\n    newName: ${escaped}\\n    digest: ${digest}$`,
    'gm',
  );
  if ((input.match(block) || []).length !== 1) {
    process.stderr.write('digest update rejected: replacement was not exact\n');
    process.exit(1);
  }
}
NODE

restore_needed=0
rm -f "$candidate" "$original" "$verification" || true
trap - EXIT HUP INT TERM
