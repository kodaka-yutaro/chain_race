# DDNet references

ChainRace uses an independent TypeScript adaptation of DD-style mechanics. It is not the original DDNet engine and does not claim binary map or simulation compatibility. No DDNet editor artwork is included. Course area visuals are drawn by ChainRace and the bun, bicycle and spirit pickup images were generated for this project.

References: [gamecore.cpp](https://github.com/ddnet/ddnet/blob/master/src/game/gamecore.cpp), [mapitems.h](https://github.com/ddnet/ddnet/blob/master/src/game/mapitems.h), [character.cpp](https://github.com/ddnet/ddnet/blob/master/src/game/server/entities/character.cpp). Source license: [DDNet license.txt](https://github.com/ddnet/ddnet/blob/master/license.txt), inspected 2026-10-29.

The upstream source notice is retained below. Changes and simplifications in shared/ddrace.ts, shared/dd-parts.ts and shared/physics.ts are ChainRace adaptations.

```
Teeworlds Copyright (C) 2007-2014 Magnus Auvinen
DDRace    Copyright (C) 2010-2011 Shereef Marzouk
DDNet     Copyright (C)           Dennis Felsing

This software is provided 'as-is', without any express or implied
warranty.  In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
  claim that you wrote the original software. If you use this software
  in a product, an acknowledgment in the product documentation would be
  appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
  misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

Hook launch offset (28 × 1.5), terrain sampling (floor(distance + 1)), coordinate rounding, and terrain hit positions were aligned with DDNet gamecore.cpp, gamecore.h and [collision.cpp](https://github.com/ddnet/ddnet/blob/master/src/game/collision.cpp) on 2026-10-30. ChainRace-specific moving objects and abilities remain independent extensions.

Player-to-player radial velocity response and swept movement collision follow CCharacterCore::TickDeferred and Move from gamecore.cpp (2026-10-30). Custom flat head support, head grounding and horizontal head carrying were removed; mini-block head assistance was also removed.


## License and distribution audit (2026-10-30)

DDNet-derived TypeScript adaptations include shared/ddrace.ts, shared/dd-parts.ts, shared/physics.ts, shared/held-input.ts and client/host/game.ts. They are modified adaptations, not the original engine. The zlib notice above applies to the adapted portions. Original authorship is not claimed.

Sunny Side Up: Copyright Ravie. The upstream data/maps/license.txt explicitly names it as CC-BY-SA; the enclosing DDNet license.txt specifies CC BY-SA 3.0 for data not otherwise licensed. The converted collision/game/front layout shared/dd-sunny.json is distributed under CC BY-SA 3.0, with attribution and modifications identified. Source: https://ddnet.org/maps/Sunny-32-Side-32-Up and https://github.com/ddnet/ddnet/blob/master/data/maps/license.txt . License: https://creativecommons.org/licenses/by-sa/3.0/ . The original map includes grass_main artwork noted upstream as Apache 2.0; the original .map is therefore no longer bundled. Original map downloads remain available upstream.

Kobra: author Zerodin, https://ddnet.org/maps/Kobra . The consulted upstream map license file does not name Kobra. No redistribution permission was verified, so its original map and converted layout are excluded from this revision. Do not reintroduce them without verifying the applicable license or obtaining permission.
