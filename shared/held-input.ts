// ChainRace modified TypeScript adaptation of DDNet/DDRace/Teeworlds.
// Original authors and zlib terms: THIRD_PARTY_NOTICES.md and client/public/licenses/DDNet-zlib.txt.
import type {Input} from './physics';

/** Preserve continuous controls and aim, never replay one-shot commands. */
export function heldInput(input:Input):Input {
  return {...input,kill:false,spit:false,miniSpit:false,clearWord:false,weapon:undefined};
}
