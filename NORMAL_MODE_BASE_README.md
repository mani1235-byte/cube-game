# Cube Game — Normal Mode Base

The current multiplayer/lobby/competition entry points have been removed.

The normal gameplay remains the base game.

`normal-mode-base.js` is a copy of the normal gameplay script saved as the
starting point for the future multiplayer implementation. It is not loaded
separately, so the game does not execute the normal code twice.

Future multiplayer should be built around this normal gameplay logic.
