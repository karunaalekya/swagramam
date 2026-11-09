#!/usr/bin/env bash
# Asks for the Web3Forms key (hidden) and puts it in the 2 files. Run from repo root.
read -rs -p "Web3Forms access key: " K; echo
[ -z "$K" ] && { echo "No key. Stopped."; exit 1; }
sed -i "s/__WEB3FORMS_KEY__/$K/g" catering.html index.html
echo "Done. Left over placeholders: $(grep -c __WEB3FORMS_KEY__ catering.html index.html | tr '\n' ' ')"
