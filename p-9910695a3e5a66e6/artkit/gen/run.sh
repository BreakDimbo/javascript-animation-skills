#!/bin/bash
# usage: run.sh name prompt_file [image...]
n=$1; p=$2; shift 2; args=()
for i in "$@"; do args+=(-i "$i"); done
timeout 900 codex exec --skip-git-repo-check -s workspace-write "${args[@]}" < "$p" > log_$n.txt 2>&1; echo "EXIT $?" >> log_$n.txt
