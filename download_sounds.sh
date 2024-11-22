#!/bin/bash
mkdir -p sounds
cd sounds

# Download sound effects from freesound.org (these are example URLs - they will need to be replaced with actual sound files)
curl -o move.mp3 "https://freesound.org/data/previews/242/242503_1815904-lq.mp3"
curl -o merge.mp3 "https://freesound.org/data/previews/242/242503_1815904-lq.mp3"
curl -o win.mp3 "https://freesound.org/data/previews/242/242503_1815904-lq.mp3"
curl -o lose.mp3 "https://freesound.org/data/previews/242/242503_1815904-lq.mp3"
