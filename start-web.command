#!/bin/zsh
cd "${0:A:h}"
print "Open http://localhost:4173 in your browser. Press Ctrl+C to stop."
exec python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
