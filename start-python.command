#!/bin/zsh
cd "${0:A:h}"
if [[ ! -x .venv/bin/python ]]; then
  print "First set up the Python environment using the README."
  read "reply?Press Enter to close."
  exit 1
fi
exec .venv/bin/python python/app.py
