# DDNet references

ChainRace uses an independent TypeScript adaptation of DD-style mechanics. It is not the original DDNet engine and does not claim binary map or simulation compatibility. No DDNet artwork, sounds or trademarks are included as game assets.

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
